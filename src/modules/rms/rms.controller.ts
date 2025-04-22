// rms.controller.ts

import { Request, Response } from 'express';
import { db } from '@app/database';
import { UserInvestmentSegment, AccountStatusValidationResult , SuspensionDetails, KycDetails, SegmentValidationResult, RiskProfileResponse, OrderTypeValidationResult, ProductOrderTypeCombination ,QuantityValidationResult, ValidityValidationResult, LotSizeConfig, LotSizeConfiguration} from '@app/database/db';
import { AccountStatus, OrderValidity } from './rms.types';
import { calculateRiskScore } from '@app/services/rms.service';
import { BadRequestError , NotFoundError} from '@app/apiError';
import logger from '@app/logger';
import { OK, BAD_REQUEST } from '@app/utils/httpstatus';

const checkClientAccountStatus = async (req: Request, res: Response): Promise<void> => {
  // For now, hardcode a userId or get it from query params
  // Later this will come from authentication middleware
  const userId = parseInt(req.query.userId as string, 10) || 1;
  const clientId = userId.toString();

  const clientAccount = await db
    .selectFrom('client_accounts')
    .where('client_id', '=', clientId)
    .select(['account_status', 'last_activity_date', 'activation_date'])
    .executeTakeFirst(); 

  if (!clientAccount) {
    throw new NotFoundError(`Client Account with ${clientId} Not Found`);
  }

  const accountStatus = clientAccount.account_status as AccountStatus;
  const result = await validateAccountStatus(clientId, accountStatus);

  await statusCheck(clientId, result);

  if (result.isValid) {
    res.status(OK).json({ message: 'Client account status is valid' });
  } else {
    res.status(BAD_REQUEST).json({ message: result.reason, details: result.additionalInfo || {} });
  }
};

const validateAccountStatus = async (clientId: string, accountStatus: AccountStatus): Promise<AccountStatusValidationResult> => {
  switch (accountStatus) {
    case AccountStatus.ACTIVE:
      return {
        isValid: true,
        status: AccountStatus.ACTIVE,
        reason: "Account is active and approved for trading"
      };

    case AccountStatus.DORMANT:
      return {
        isValid: false,
        status: AccountStatus.DORMANT,
        reason: "Account is dormant due to inactivity for over 12 months",
        additionalInfo: {
            // Restricting Features --> ALL
          restrictedFeatures: ["Trading", "Investments", "Fund transfers"],
          reactivationSteps: [
            "Complete OTP verification",
            "Submit reactivation request",
            "Update KYC if information is outdated"
          ]
        }
      };

    case AccountStatus.SUSPENDED:
      const suspensionDetails = await fetchSuspensionDetails(clientId);
      return {
        isValid: false,
        status: AccountStatus.SUSPENDED,
        reason: `Account is suspended: ${suspensionDetails.reason}`,
        additionalInfo: {
          restrictedFeatures: ["All trading activities", "Fund operations"],
          requiredActions: [
            suspensionDetails.requiredAction,
            "Contact customer support for assistance"
          ]
        }
      };

    case AccountStatus.PENDING_KYC:
      const { pendingItems }: KycDetails = await fetchPendingKycItems(clientId);
      return {
        isValid: false,
        status: AccountStatus.PENDING_KYC,
        reason: "Account setup is incomplete. KYC verification pending",
        additionalInfo: {
          restrictedFeatures: ["Trading", "Investments"],
          requiredActions: pendingItems.map(item => `Complete ${item}`)
        }
      };

    case AccountStatus.CLOSED:
      return {
        isValid: false,
        status: AccountStatus.CLOSED,
        reason: "Account has been permanently closed",
        additionalInfo: {
          restrictedFeatures: ["All services"],
          requiredActions: ["Contact customer support if closure was unintended"]
        }
      };

    default:
      return {
        isValid: false,
        status: accountStatus,
        reason: "Unknown account status. Please contact support."
      };
  }
};

const fetchSuspensionDetails = async(clientId:string): Promise<SuspensionDetails> =>{
    const suspensionRecord = await db
      .selectFrom('account_suspensions')
      .where('client_id', '=', clientId)
      .where('resolved_at', 'is', null)
      .orderBy('suspended_at', 'desc')
      .select(['reason', 'required_action']) 
      .executeTakeFirst();

    if (!suspensionRecord) {
        // Default response if no record found
        return {
          reason: "Account suspension (details unavailable)",
          requiredAction: "Contact customer support"
        };
    }
    return {
        reason: suspensionRecord.reason,
        requiredAction: suspensionRecord.required_action
    };
}

const fetchPendingKycItems = async(clientId: string): Promise<KycDetails> =>{
    const signupCheckpoint = await db
      .selectFrom('signup_checkpoints')
      .where('id', '=', parseInt(clientId, 10))
      .select([
        'pan_id', 
        'aadhaar_id', 
        'address_id', 
        'ipv'
      ])
      .executeTakeFirst();
    
      if (!signupCheckpoint) {
        return {
          panVerified: false,
          aadhaarVerified: false,
          bankVerified: false,
          ipvCompleted: false,
          pendingItems: ["Complete KYC process"]
        };
    }

    // check for the pan , Aadhar, address and IPV --> if completed

    const panVerified = !!signupCheckpoint.pan_id;
    const aadhaarVerified = !!signupCheckpoint.aadhaar_id;
    const ipvCompleted = !!signupCheckpoint.ipv;

    const bankAccount = await db
      .selectFrom('bank_to_user')
      .where('user_id', '=', parseInt(clientId, 10))
      .executeTakeFirst();
      
    const bankVerified = !!bankAccount;
    
    // Create a list of pending items
    const pendingItems: string[] = [];
    
    if (!panVerified) {
      pendingItems.push("PAN verification");
    }
    
    if (!aadhaarVerified) {
      pendingItems.push("Aadhaar verification");
    }
 
    if (!ipvCompleted) {
        pendingItems.push("In-person verification (IPV)");
    }
      
    if (!bankVerified) {
        pendingItems.push("Bank account verification");
    }

    if (pendingItems.length === 0) {
        pendingItems.push("KYC verification in process");
      }
      
      return {
        panVerified,
        aadhaarVerified,
        bankVerified,
        ipvCompleted,
        pendingItems
    };
}


const statusCheck = async( clientId: string, result: AccountStatusValidationResult):Promise<void> =>{
    await db
    .insertInto('segment_checks')
    .values({
        client_id: clientId,
        check_type: 'ACCOUNT_STATUS',
        passed: result.isValid,
        reason: result.isValid ? 'Account is active' : result.reason,
        additional_data: JSON.stringify({
          accountStatus: result.status,
          additionalInfo: result.additionalInfo
        }),
        timestamp: new Date()
    })
    .executeTakeFirstOrThrow();
}

const updateClientAccountStatus = async(req: Request, res: Response): Promise<void> => {
  // For now, hardcode a userId or get it from query params
  // Later this will come from authentication middleware
    const userId = parseInt(req.query.userId as string, 10) || 1;
    const clientId = userId.toString();
    const { newStatus, reason } = req.body;
    
    if (!clientId) {
      throw new BadRequestError('Client ID is required');
    }
    
    if (!newStatus || !Object.values(AccountStatus).includes(newStatus as AccountStatus)) {
      throw new BadRequestError('Valid new account status is required');
    }
    
    if (!reason) {
      throw new BadRequestError('Reason for status change is required');
    }
    
      // Get current status 
      const currentStatusRecord = await db
        .selectFrom('client_accounts')
        .where('client_id', '=', clientId)
        .select(['account_status'])
        .executeTakeFirst();
        
      if (!currentStatusRecord) {
        throw new NotFoundError(`Client account ${clientId} not found`);
      }
      
      const currentStatus = currentStatusRecord.account_status;
      
      // Use transaction to update status
      await db.transaction().execute(async (trx) => {
        // Update account status
        await trx
          .updateTable('client_accounts')
          .set({
            account_status: newStatus,
            status_change_reason: reason,
            last_status_change_date: new Date()
          })
          .where('client_id', '=', clientId)
          .execute();
          
        await trx
          .insertInto('account_status_audit')
          .values({
            client_id: clientId,
            previous_status: currentStatus,
            new_status: newStatus,
            change_reason: reason,
            // changed_by: req.user?.username || 'system', 
            changed_by: 'system', // Need to include Middleware
            ip_address: req.ip,
            timestamp: new Date()
          })
          .execute();
      });
      
      logger.info(`Account status updated for client ${clientId} from ${currentStatus} to ${newStatus}`);
      
      res.status(OK).json({
        message: `Account status updated from ${currentStatus} to ${newStatus}`,
        clientId,
        previousStatus: currentStatus,
        newStatus
    });
}


// check for the Segment Activated

const checkSegmentActivation = async (req: Request, res: Response): Promise<void> => {
  // For now, hardcode a userId or get it from query params
  // Later this will come from authentication middleware
  const userId = parseInt(req.query.userId as string, 10) || 1;
  const clientId = userId.toString();
  const tradeType: string = req.body.trade_type;
  const symbol: string = req.body.symbol;

  if (!clientId) {
    throw new BadRequestError('Client ID is required');
  }
  
  if (!tradeType || !symbol) {
    throw new BadRequestError('Trade type and symbol are required');
  }

  // checking if the account is active
  const clientAccount = await db
    .selectFrom('client_accounts')
    .where('client_id', '=', clientId)
    .select(['account_status'])
    .executeTakeFirst();

  if (!clientAccount) {
    throw new NotFoundError(`Client Account with ${clientId} Not Found`);
  }
  if (clientAccount.account_status !== AccountStatus.ACTIVE) {
    res.status(BAD_REQUEST).json({ 
      isValid: false, 
      message: 'Account is not active',
    });
    return;
  }

  const segment = determineSegmentFromTradeType(tradeType, symbol);
  const result = await validateSegmentActivation(clientId, segment);

  await segmentCheck(clientId, segment, result);

  if (result.isValid) {
    res.status(OK).json({ 
      isValid: true, 
      message: result.reason,
      trade_type: tradeType,
      symbol,
      segment 
    });
  } else {
    res.status(BAD_REQUEST).json({ 
      isValid: false, 
      message: result.reason,
      trade_type: tradeType,
      symbol,
      segment,
      details: result.additionalInfo || {}
    });
  }
}

// Validating Segment Activation

const validateSegmentActivation = async (
  clientId: string, 
  segment: UserInvestmentSegment
): Promise<SegmentValidationResult> => {
  const segmentRecord = await db
  .selectFrom('investment_segments_to_user')
  .where('user_id', '=', parseInt(clientId, 10))
  .where('segment', '=', segment)
  .executeTakeFirst();

if (segmentRecord) {
  return {
    isValid: true,
    segment,
    reason: `${segment} segment is active for this account`
  };
} else {
  // Get the segments that are activated
  const activeSegments = await db
    .selectFrom('investment_segments_to_user')
    .where('user_id', '=', parseInt(clientId, 10))
    .select(['segment'])
    .execute();

  const availableSegments = activeSegments.map(record => record.segment);
  
  return {
    isValid: false,
    segment,
    reason: `${segment} segment is not activated for this account`,
    additionalInfo: {
      activatedSegments: availableSegments,
      activationSteps: [
        "Contact customer support to activate this segment",
        "Complete any pending KYC requirements for this segment"
      ]
    }
  };
  }
}

// Determine which investment segment is required based on trade type and symbol

const determineSegmentFromTradeType = (tradeType: string, symbol: string): UserInvestmentSegment => {
  // Map the trade type to the appropriate segment
  switch (tradeType) {
    case 'equity_delivery':
    case 'equity_intraday':
      return 'Cash';
    
    case 'equity_futures':
    case 'equity_options':
      return 'F&O';
    
    case 'commodity_futures':
    case 'commodity_options':
      return 'Commodity';
    
    case 'currency_futures':
    case 'currency_options':
      return 'Currency';
    
    default:
      const uppercaseSymbol = symbol.toUpperCase();
      
      if (uppercaseSymbol.startsWith('GOLD') || 
          uppercaseSymbol.startsWith('SILVER') || 
          uppercaseSymbol.startsWith('CRUDE')) {
        return 'Commodity';
      }
      
      if (uppercaseSymbol.startsWith('USDINR') || 
          uppercaseSymbol.startsWith('EURINR') ||
          uppercaseSymbol.startsWith('JPYINR')) {
        return 'Currency';
      }
      
      if (uppercaseSymbol.startsWith('GOVT') || 
          uppercaseSymbol.includes('BOND') ||
          uppercaseSymbol.includes('TBILL')) {
        return 'Debt';
      }
      
      // Default to Cash if we can't determine
      return 'Cash';
  }
};

// Segment-Check Function

const segmentCheck = async (
  clientId: string, 
  segment: UserInvestmentSegment, 
  result: SegmentValidationResult
): Promise<void> => {
  await db
    .insertInto('segment_checks')
    .values({
      client_id: clientId,
      check_type: 'SEGMENT_ACTIVATION',
      passed: result.isValid,
      reason: result.reason,
      additional_data: JSON.stringify({
        segment: result.segment,
        additionalInfo: result.additionalInfo
      }),
      timestamp: new Date()
    })
    .executeTakeFirstOrThrow();

  logger.info(
    `Segment activation check for client ${clientId}, segment ${segment}: ${result.isValid ? 'PASSED' : 'FAILED'}`
  );
};

// Getting User Risk Profile
const getUserRiskProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.query.userId as string, 10) || 1;
  
  // Fetch the user's profile data from the database
  const userProfile = await db
  .selectFrom('user')
  .where('id', '=', userId)
  .select([
    'annual_income',
    'trading_exp', 
    'occupation',
    'marital_status',
    'is_politically_exposed' 
  ])
  .executeTakeFirst();

  if (!userProfile) {
    throw new NotFoundError(`User profile for user ID ${userId} not found`);
  }

  // Calculate the risk score based on the user's profile
  const riskScore = calculateRiskScore(
    userProfile.annual_income,
    userProfile.trading_exp,
    userProfile.occupation,
    userProfile.marital_status,
    userProfile.is_politically_exposed ? 'Yes' : 'No'
  );

  const response: RiskProfileResponse = {
    userId,
    riskCategory: riskScore.category,
    riskScore,
    timestamp: new Date()
  };

  await db
    .insertInto('risk_profile_checks')
    .values({
      user_id: userId,
      risk_category: riskScore.category,
      risk_score: riskScore.totalScore,
      check_timestamp: response.timestamp
    })
    .execute();
  
  logger.info(`Risk profile check for user ${userId}: Category ${riskScore.category}, Score ${riskScore.totalScore}`);

  res.status(OK).json({ message: `Risk profile check successful for user ID ${userId}`});
};

const validateOrderType = async(req:Request,res:Response):Promise<void> =>{
   // For now, hardcode a userId or get it from query params
  // Later this will come from authentication middleware
  const userId = parseInt(req.query.userId as string, 10) || 1;
  const clientId = userId.toString();
  
  const { order_type, product_type, symbol, trigger_price, trade_type } = req.body;
  
  if (!clientId) {
    throw new BadRequestError('Client ID is required');
  }

  // Check for the Acc is Active Or Not
  const clientAccount = await db
  .selectFrom('client_accounts')
  .where('client_id', '=', clientId)
  .select(['account_status'])
  .executeTakeFirst();

  if (!clientAccount) {
  throw new NotFoundError(`Client Account with ${clientId} Not Found`);
}

  if (clientAccount.account_status !== AccountStatus.ACTIVE) {
  res.status(BAD_REQUEST).json({ 
    message: 'Account is not active',
  });
  return;
}

// Determining the Type of Segment 
const segment = determineSegmentFromTradeType(trade_type, symbol);

const result = await validateAllowedOrderType(
  order_type,
  product_type,
  trigger_price,
  segment
);

// Log the Validation Result

await orderTypeValidationCheck(clientId, {
  orderType: order_type,
  productType: product_type,
  symbol,
  segment,
  triggerPrice: trigger_price
}, result);

// Response

if (result.isValid) {
  res.status(OK).json({ message: 'Order type validation successful' });
} else {
  res.status(BAD_REQUEST).json({ 
    message: result.reason,
    details: result.additionalInfo || {}
  });
}
};

const validateAllowedOrderType = async (
  orderType: string,
  productType: string,
  triggerPrice: number | undefined,
  segment: UserInvestmentSegment
): Promise<OrderTypeValidationResult> => {
  // 1. Check if the product type and order type combination is valid
  const isValidCombination = await isValidProductOrderTypeCombination(productType, orderType);
  
  if (!isValidCombination) {
    return {
      isValid: false,
      reason: `Order type ${orderType} is not allowed for product type ${productType}`,
      additionalInfo: {
        allowedOrderTypes: await getAllowedOrderTypesForProduct(productType),
        restrictionReason: "Product-OrderType restriction"
      }
    };
  }

  // 2. Check segment-specific order type restrictions
  const isValidForSegment = await isOrderTypeValidForSegment(segment, orderType);
  
  if (!isValidForSegment) {
    return {
      isValid: false,
      reason: `Order type ${orderType} is not allowed for ${segment} segment`,
      additionalInfo: {
        allowedOrderTypes: await getAllowedOrderTypesForSegment(segment),
        restrictionReason: "Segment-specific restriction"
      }
    };
  }
  
  // 3. Check if order type requires trigger price
  if ((orderType === 'sl' || orderType === 'sl_m') && triggerPrice === undefined) {
    return {
      isValid: false,
      reason: `Trigger price is required for ${orderType} orders`,
      additionalInfo: {
        restrictionReason: "Missing trigger price"
      }
    };
  }
  return {
    isValid: true,
    reason: `Order type ${orderType} is allowed for this order configuration`
  };
};

const isValidProductOrderTypeCombination = async (
  productType: string, 
  orderType: string
): Promise<boolean> => {
  try {
    const validCombinations = await db
    .selectFrom('product_order_type_combinations')
    .where('product_type', '=', productType)
    .where('order_type', '=', orderType)
    .executeTakeFirst() as ProductOrderTypeCombination | undefined;
    
    if (validCombinations) {
      return validCombinations.is_allowed === true;
    }
  } catch (error) {
    logger.warn('Error querying product_order_type_combinations table, using default values', error);
  }
  
  // Default allowed combinations if table doesn't exist
  const allowedCombinations: Record<string, string[]> = {
    'intraday': ['market_order', 'limit_order', 'sl', 'sl_m'],
    'delivery': ['market_order', 'limit_order', 'sl', 'sl_m'],
    'mtf': ['market_order', 'limit_order'],
    'futures': ['market_order', 'limit_order', 'sl', 'sl_m'],
    'options': ['market_order', 'limit_order', 'sl', 'sl_m']
  };
  
  return allowedCombinations[productType]?.includes(orderType) || false;
};

const getAllowedOrderTypesForProduct = async (productType: string): Promise<string[]> => {
  try {
    const allowedTypes = await db
      .selectFrom('product_order_type_combinations')
      .where('product_type', '=', productType)
      .where('is_allowed', '=', true)
      .select(['order_type'])
      .execute();
    
    if (allowedTypes && allowedTypes.length > 0) {
      return allowedTypes.map(type => type.order_type);
    }
  } catch (error) {
    logger.warn('Error querying product_order_type_combinations table, using default values', error);
  }
  
  // Default fallback if table doesn't exist yet
  const defaultAllowedTypes: Record<string, string[]> = {
    'intraday': ['market_order', 'limit_order', 'sl', 'sl_m'],
    'delivery': ['market_order', 'limit_order', 'sl', 'sl_m'],
    'mtf': ['market_order', 'limit_order'],
    'futures': ['market_order', 'limit_order', 'sl', 'sl_m'],
    'options': ['market_order', 'limit_order', 'sl', 'sl_m']
  };
  
  return defaultAllowedTypes[productType] || [];
};

const isOrderTypeValidForSegment = async (
  segment: UserInvestmentSegment, 
  orderType: string
): Promise<boolean> => {
  try {
    // Fetch segment restrictions from database if available
    const segmentRestriction = await db
      .selectFrom('segment_order_type_restrictions')
      .where('segment', '=', segment)
      .where('order_type', '=', orderType)
      .where('is_restricted', '=', true)
      .executeTakeFirst();

    if (segmentRestriction) {
      return false;
    }
  } catch (error) {
    logger.warn('Error querying segment_order_type_restrictions table, using default values', error);
  }
  
  const restrictedCombinations: Record<string, string[]> = {
    'Currency': ['sl_m'], // SL-M ---> restricted in Currency segment
    'Commodity': [] // No restrictions
  };
  
  return !(restrictedCombinations[segment]?.includes(orderType) || false);
};

const getAllowedOrderTypesForSegment = async (segment: UserInvestmentSegment): Promise<string[]> => {
  const allOrderTypes = ['market_order', 'limit_order', 'sl', 'sl_m'];
  
  try {
    const restrictedTypes = await db
      .selectFrom('segment_order_type_restrictions')
      .where('segment', '=', segment)
      .where('is_restricted', '=', true)
      .select(['order_type'])
      .execute();
    
    if (restrictedTypes && restrictedTypes.length > 0) {
      const restrictedSet = new Set(restrictedTypes.map(type => type.order_type));
      return allOrderTypes.filter(type => !restrictedSet.has(type));
    }
  } catch (error) {
    logger.warn('Error querying segment_order_type_restrictions table, using default values', error);
  }
  
  const restrictedCombinations: Record<string, string[]> = {
    'Currency': ['sl_m'],
    'Commodity': []
  };
  
  const restrictedForSegment = restrictedCombinations[segment] || [];
  return allOrderTypes.filter(type => !restrictedForSegment.includes(type));
};
const orderTypeValidationCheck = async (
  clientId: string,
  checkData: {
    orderType: string;
    productType: string;
    symbol: string;
    segment: UserInvestmentSegment;
    triggerPrice?: number;
  },
  result: OrderTypeValidationResult
): Promise<void> => {
  await db
    .insertInto('segment_checks')
    .values({
      client_id: clientId,
      check_type: 'ORDER_TYPE_VALIDATION',
      passed: result.isValid,
      reason: result.reason,
      additional_data: JSON.stringify({
        orderType: checkData.orderType,
        productType: checkData.productType,
        symbol: checkData.symbol,
        segment: checkData.segment,
        triggerPrice: checkData.triggerPrice,
        additionalInfo: result.additionalInfo
      }),
      timestamp: new Date()
    })
    .executeTakeFirstOrThrow();
  logger.info(
    `Order type validation check for client ${clientId}, product ${checkData.productType}, order type ${checkData.orderType}: ${result.isValid ? 'PASSED' : 'FAILED'}`
  );
};

const validateOrderValidity = async(req:Request , res:Response):Promise<void> =>{
  // For now, hardcode a userId or get it from query params
  // Later this will come from authentication middleware
  const userId = parseInt(req.query.userId as string, 10) || 1;
  const clientId = userId.toString();

  const{
    product_type,
    validity_type,
    validity_minutes,
    symbol,
    trade_type
  } = req.body;

  if(!product_type || !validity_type){
    throw new BadRequestError("Product Type and validity type are required");
  }

  if(validity_type === OrderValidity.MINUTES && !validity_minutes){
    throw new BadRequestError("Minutes Value is required")
  }

  // check Account is Active
  const clientAccount = await db
  .selectFrom('client_accounts')
  .where('client_id','=',clientId)
  .select(['account_status'])
  .executeTakeFirst();

  if(!clientAccount){
    throw new NotFoundError(`Client Account with ${clientId} Not Found`);
  }
  
  if(clientAccount.account_status !== AccountStatus.ACTIVE){
    res.status(BAD_REQUEST).json({
      message:"Account is Not Active"
    });
    return;
  }

  const segment = determineSegmentFromTradeType(trade_type , symbol);

  // order-validity
  const result = await validateValidityType(
    product_type,
    validity_type as OrderValidity,
    validity_minutes,
    segment
  );
  
  // Log the validation result
  await validityValidationCheck(clientId, {
    productType: product_type,
    validityType: validity_type,
    validityMinutes: validity_minutes,
    symbol,
    segment
}, result);

// Return response
if (result.isValid) {
    res.status(OK).json({ 
        isValid: true,
        message: result.reason 
    });
  } else {
    res.status(BAD_REQUEST).json({ 
        isValid: false,
        message: result.reason,
        details: result.additionalInfo || {}
    });
  }
};

// Validation Logic

const validateValidityType = async (
  productType: string,
  validityType: OrderValidity,
  validityMinutes: number | undefined,
  segment: UserInvestmentSegment
): Promise<ValidityValidationResult> => {

  const allowedValidityByProduct: Record<string, OrderValidity[]> = {
    'delivery': [OrderValidity.DAY],          // Delivery --> only DAY
    'intraday': [OrderValidity.DAY, OrderValidity.IMMEDIATE, OrderValidity.MINUTES], // Intraday --> ALL
    'mtf': [OrderValidity.DAY],                   // MTF --> only DAY
    'futures': [OrderValidity.DAY, OrderValidity.IMMEDIATE, OrderValidity.MINUTES], // F&O --> all
    'options': [OrderValidity.DAY, OrderValidity.IMMEDIATE, OrderValidity.MINUTES]  // F&O --> all
};

const isValid = allowedValidityByProduct[productType]?.includes(validityType) || false;
    
if (!isValid) {
    return {
        isValid: false,
        reason: `${validityType} validity is not allowed for ${productType} orders`,
        additionalInfo: {
            allowedValidityTypes: allowedValidityByProduct[productType] || [OrderValidity.DAY],
            restrictionReason: `${productType} orders only support ${allowedValidityByProduct[productType]?.join(', ')} validity`
        }
    };
}

if (validityType === OrderValidity.MINUTES) {
    if (!validityMinutes || validityMinutes <= 0 || validityMinutes > 180) { // Max 3 hours
        return {
            isValid: false,
            reason: `For MINUTES validity, a value between 1 and 3600 minutes must be provided`,
            additionalInfo: {
                restrictionReason: "Invalid minutes value"
            }
        };
    }
}

return {
    isValid: true,
    reason: getSuccessMessage(productType, validityType)
  }
};
const getSuccessMessage = (productType: string, validityType: OrderValidity): string => {
  switch (validityType) {
      case OrderValidity.DAY:
          return `DAY validity allowed for ${productType} orders.`;
      case OrderValidity.IMMEDIATE:
          return `IMMEDIATE validity allowed for ${productType} orders.`;
      case OrderValidity.MINUTES:
          return `MINUTES validity allowed for ${productType} orders.`;
      default:
          return `${validityType} validity allowed for ${productType} orders.`;
  }
};

const validityValidationCheck = async (
  clientId: string,
  checkData: {
      productType: string;
      validityType: string;
      validityMinutes?: number;
      symbol: string;
      segment: UserInvestmentSegment;
  },
  result: ValidityValidationResult
): Promise<void> => {
  await db
      .insertInto('segment_checks')
      .values({
          client_id: clientId,
          check_type: 'ORDER_VALIDITY_VALIDATION',
          passed: result.isValid,
          reason: result.reason,
          additional_data: JSON.stringify({
              productType: checkData.productType,
              validityType: checkData.validityType,
              validityMinutes: checkData.validityMinutes,
              symbol: checkData.symbol,
              segment: checkData.segment,
              additionalInfo: result.additionalInfo
          }),
          timestamp: new Date()
      })
      .executeTakeFirstOrThrow();
  
  logger.info(
      `Order validity validation check for client ${clientId}, product ${checkData.productType}, validity type ${checkData.validityType}: ${result.isValid ? 'PASSED' : 'FAILED'}`
  );
};

const validateQuantityMultiple = async (req: Request, res: Response): Promise<void> => {
  // For now, hardcode a userId or get it from query params
  // Later this will come from authentication middleware
  const userId = parseInt(req.query.userId as string, 10) || 1;
  const clientId = userId.toString();
  
  const { symbol, quantity, trade_type, exchange } = req.body;
  
  if (!symbol || !quantity) {
    throw new BadRequestError('Symbol and quantity are required');
  }

  // Check if the account is active
  const clientAccount = await db
    .selectFrom('client_accounts')
    .where('client_id', '=', clientId)
    .select(['account_status'])
    .executeTakeFirst();

  if (!clientAccount) {
    throw new NotFoundError(`Client Account with ${clientId} Not Found`);
  }

  if (clientAccount.account_status !== AccountStatus.ACTIVE) {
    res.status(BAD_REQUEST).json({ 
      message: 'Account is not active',
    });
    return;
  }
  const segment = determineSegmentFromTradeType(trade_type, symbol);
  
  // Validate quantity
  const result: QuantityValidationResult = await validateQuantity(symbol, quantity, segment, trade_type, exchange);
  
  // Log the validation result
  await quantityValidationCheck(clientId, {
    symbol,
    quantity,
    segment,
    trade_type,
    exchange
  }, result);
  
  // Return response
  if (result.isValid) {
    res.status(OK).json({ 
      isValid: true,
      message: result.reason 
    });
  } else {
    res.status(BAD_REQUEST).json({ 
      isValid: false,
      message: result.reason,
      details: result.additionalInfo || {}
    });
  }
};

const validateQuantity = async (
  symbol: string,
  quantity: number,
  segment: UserInvestmentSegment,
  tradeType: string,
  exchange: string
): Promise<QuantityValidationResult> => {
  if (segment === 'F&O' || segment === 'Commodity' || segment === 'Currency') {
    return validateDerivativeQuantity(symbol, quantity, segment, exchange);
  }
  
  // For equity (Cash segment)
  if (segment === 'Cash') {
    return validateEquityQuantity(symbol, quantity, tradeType, exchange);
  }
  // Default case for other segments (e.g., Debt)
  return {
    isValid: true,
    reason: 'Quantity validation successful'
  };
};

const validateDerivativeQuantity = async (
  symbol: string,
  quantity: number,
  segment: UserInvestmentSegment,
  exchange: string
): Promise<QuantityValidationResult> => {
  
  const lotSizeData = await db
  .selectFrom('lot_size_config')
  .where('symbol','=',symbol)
  .where('segment', '=', segment)
  .where('exchange', '=', exchange)
  .where('effective_from', '<=', new Date())
  .where((eb) => 
    eb.or([
      eb('effective_to', 'is', null),
      eb('effective_to', '>=', new Date())
    ])
  )
  .select(['lot_size', 'max_order_quantity'])
  .executeTakeFirst() as LotSizeConfiguration | undefined;;

let lotSize: LotSizeConfig;

if (!lotSizeData) {
  if (segment === 'F&O' || segment === 'Commodity' || segment === 'Currency') {
    const defaultLotSizes: Record<'F&O' | 'Commodity' | 'Currency', number> = {
      'F&O': 50,
      'Commodity': 1,
      'Currency': 1000
    };

    lotSize = {
      symbol,
      segment,
      lotSize: defaultLotSizes[segment],
      maxOrderQuantity: undefined
    };
    logger.warn(`Using default lot size for ${symbol} in ${segment} segment`);
  } else {
    throw new Error(`Unsupported segment: ${segment}`);
  }
} else {
  lotSize = {
    symbol,
    segment,
    lotSize: lotSizeData.lot_size,
    maxOrderQuantity: lotSizeData.max_order_quantity || undefined
    };
  }
  const maxLotsPossible = lotSize.maxOrderQuantity 
  ? Math.floor(lotSize.maxOrderQuantity / lotSize.lotSize)
  : undefined;

// Check if quantity is multiple of lot size
if (quantity % lotSize.lotSize !== 0) {
  const suggestedQuantity = Math.round(quantity / lotSize.lotSize) * lotSize.lotSize;
  return {
    isValid: false,
    reason: `Quantity must be a multiple of lot size (${lotSize.lotSize})`,
    additionalInfo: {
      requiredLotSize: lotSize.lotSize,
      suggestedQuantity: suggestedQuantity || lotSize.lotSize,
      maxLotsPossible
    }
  };
}

// Check if quantity exceeds maximum allowed
if (lotSize.maxOrderQuantity && quantity > lotSize.maxOrderQuantity) {
  return {
    isValid: false,
    reason: `Quantity exceeds maximum allowed (${lotSize.maxOrderQuantity})`,
    additionalInfo: {
      maxAllowedQuantity: lotSize.maxOrderQuantity,
      suggestedQuantity: lotSize.maxOrderQuantity,
      maxLotsPossible
    }
  };
}

return {
  isValid: true,
  reason: 'Quantity validation successful for derivative order',
  additionalInfo: {
    requiredLotSize: lotSize.lotSize,
    maxAllowedQuantity: lotSize.maxOrderQuantity,
    maxLotsPossible
  }
};
};

const validateEquityQuantity = async (
  symbol: string,
  quantity: number,
  tradeType: string,
  exchange: string
): Promise<QuantityValidationResult> => {
  try {
    // Fetch maximum quantity limit for equity
    const equityLimit = await db
      .selectFrom('equity_max_quantity_limit')
      .where('symbol', '=', symbol)
      .where('exchange', '=', exchange)
      .where('trade_type', '=', tradeType === 'equity_delivery' ? 'delivery' : 'intraday')
      .where('effective_from', '<=', new Date())
      .where((eb) => 
        eb.or([
          eb('effective_to', 'is', null),
          eb('effective_to', '>=', new Date())
        ])
      )
      .select(['max_order_quantity'])
      .executeTakeFirst();
    
    // Default maximum quantity 
    const maxQuantity = equityLimit?.max_order_quantity || 
      (tradeType === 'equity_delivery' ? 10000 : 50000); // Example defaults
    
    // Check for QTy is negative
    if (quantity <= 0) {
      return {
        isValid: false,
        reason: 'Quantity must be a positive number',
        additionalInfo: {
          suggestedQuantity: 1
        }
      };
    }
    
    // Check if quantity is a whole number
    if (!Number.isInteger(quantity)) {
      return {
        isValid: false,
        reason: 'Equity quantity must be a whole number',
        additionalInfo: {
          suggestedQuantity: Math.round(quantity)
        }
      };
    }
    
    // Check if quantity exceeds maximum allowed
    if (quantity > maxQuantity) {
      return {
        isValid: false,
        reason: `Quantity exceeds maximum allowed (${maxQuantity})`,
        additionalInfo: {
          maxAllowedQuantity: maxQuantity,
          suggestedQuantity: maxQuantity
        }
      };
    }
    
    return {
      isValid: true,
      reason: 'Quantity validation successful for equity order'
    };
    
  } catch (error) {
    logger.error('Error validating equity quantity:', error);
    throw error;
  }
};

const quantityValidationCheck = async (
  clientId: string,
  checkData: {
    symbol: string;
    quantity: number;
    segment: UserInvestmentSegment;
    trade_type: string;
    exchange: string;
  },
  result: QuantityValidationResult
): Promise<void> => {
  await db
    .insertInto('segment_checks')
    .values({
      client_id: clientId,
      check_type: 'QUANTITY_VALIDATION',
      passed: result.isValid,
      reason: result.reason,
      additional_data: JSON.stringify({
        symbol: checkData.symbol,
        quantity: checkData.quantity,
        segment: checkData.segment,
        trade_type: checkData.trade_type,
        exchange: checkData.exchange,
        additionalInfo: result.additionalInfo
      }),
      timestamp: new Date()
    })
    .executeTakeFirstOrThrow();
  
  logger.info(
    `Quantity validation check for client ${clientId}, symbol ${checkData.symbol}, quantity ${checkData.quantity}: ${result.isValid ? 'PASSED' : 'FAILED'}`
  );
};

export {
    checkClientAccountStatus,
    updateClientAccountStatus,
    checkSegmentActivation,
    getUserRiskProfile,
    validateOrderType,
    validateOrderValidity,
    validateQuantityMultiple
};