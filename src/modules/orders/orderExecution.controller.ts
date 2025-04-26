// orderExecution.controller.ts

import { Request, Response } from 'express';
import { db } from '@app/database';
import { BadRequestError, NotFoundError } from '@app/apiError';
import {
    ExecuteOrderRequest,
    ExecuteNextLegRequest,
    ChargesData,
    RejectOrderRequest,
    ExecuteStopLossRequest,
} from '@app/database/db';
import { OrderStatus, OrderCategory, OrderSide, ProductType } from './order.types';
import { applyOrderCharges } from '../charges/charges.service';
import logger from '@app/logger';
import { OK } from '@app/utils/httpstatus';

const executeOrder = async (req: Request, res: Response): Promise<void> => {
    const orderId = parseInt(req.params.orderId, 10);
    const { executionPrice, exchangeOrderId, remarks }: ExecuteOrderRequest = req.body;

    if (!executionPrice) {
        throw new BadRequestError('Execution Price is Required');
    }

    const result = await db.transaction().execute(async (trx) => {
        const order = await trx.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst();

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Validate order status
        if (order.status !== OrderStatus.QUEUED) {
            throw new BadRequestError(`Cannot execute order with status "${order.status}"`);
        }

        // updating order status
        const updatedOrder = await trx
            .updateTable('orders')
            .set({
                status: OrderStatus.EXECUTED,
                executed_at: new Date(),
                price: executionPrice, //  Needs to Update with actual execution price
                order_id: exchangeOrderId || null,
            })
            .where('id', '=', orderId)
            .returningAll()
            .executeTakeFirst();

        // Create order history record
        await trx
            .insertInto('order_history')
            .values({
                order_id: orderId,
                previous_status: OrderStatus.QUEUED,
                new_status: OrderStatus.EXECUTED,
                changed_at: new Date(),
                remarks: remarks || 'Order executed',
                changed_by: 'system',
            })
            .execute();

        // handling different types of orders
        const additionalData: any = {};
        let currentLeg = null;

        switch (order.order_category) {
            case OrderCategory.INSTANT:
                break;

            case OrderCategory.NORMAL:
                break;

            case OrderCategory.ICEBERG:
                const icebergOrder = await trx
                    .selectFrom('iceberg_orders')
                    .where('order_id', '=', orderId)
                    .selectAll()
                    .executeTakeFirst();

                // get the first leg
                currentLeg = await trx
                    .selectFrom('iceberg_legs')
                    .where('iceberg_order_id', '=', orderId)
                    .where('status', '=', OrderStatus.QUEUED)
                    .orderBy('leg_number', 'asc')
                    .selectAll()
                    .executeTakeFirst();

                if (currentLeg) {
                    await trx
                        .updateTable('iceberg_legs')
                        .set({
                            status: OrderStatus.EXECUTED,
                            executed_at: new Date(),
                        })
                        .where('id', '=', currentLeg.id)
                        .execute();

                    // Get the next leg
                    const nextLeg = await trx
                        .selectFrom('iceberg_legs')
                        .where('iceberg_order_id', '=', orderId)
                        .where('leg_number', '>', currentLeg.leg_number)
                        .orderBy('leg_number', 'asc')
                        .selectAll()
                        .executeTakeFirst();

                    // If there's a next leg, update its status to queued
                    if (nextLeg) {
                        await trx
                            .updateTable('iceberg_legs')
                            .set({
                                status: OrderStatus.QUEUED,
                            })
                            .where('id', '=', nextLeg.id)
                            .execute();
                    }
                    // Add to response data
                    additionalData.icebergExecution = {
                        currentLeg,
                        nextLeg: nextLeg || null,
                        remainingLegs: !!nextLeg,
                        productType: icebergOrder?.product_type,
                    };
                }
                break;
            case OrderCategory.COVER_ORDER:
                const coverOrder = await trx
                    .selectFrom('cover_orders')
                    .where('order_id', '=', orderId)
                    .selectAll()
                    .executeTakeFirst();
                // Update cover order details
                const updatedCoverOrderDetails = await trx
                    .updateTable('cover_order_details')
                    .set({
                        main_order_status: OrderStatus.EXECUTED,
                        main_order_executed_at: new Date(),
                        main_order_id: exchangeOrderId || null,
                    })
                    .where('cover_order_id', '=', orderId)
                    .returningAll()
                    .executeTakeFirst();

                // Add to response data
                additionalData.coverOrderExecution = {
                    coverOrder,
                    coverOrderDetails: updatedCoverOrderDetails,
                    stopLossActive: true,
                };
                break;
        }

        // Apply charges ---> executed order
        if (order.order_category === OrderCategory.ICEBERG && currentLeg) {
            // applying charges based on legs qty.
            const legQuantity = currentLeg?.quantity || 0;

            if (legQuantity > 0) {
                const icebergOrder = await trx
                    .selectFrom('iceberg_orders')
                    .where('order_id', '=', orderId)
                    .selectAll()
                    .executeTakeFirst();

                const segmentName =
                    icebergOrder?.product_type === ProductType.INTRADAY ? 'EQUITY INTRADAY' : 'EQUITY DELIVERY';

                // transaction value for this leg
                const transactionValue = legQuantity * executionPrice;
                // Get charges configuration from DB
                const segment = await trx
                    .selectFrom('market_segments')
                    .where('name', '=', segmentName)
                    .select(['id'])
                    .executeTakeFirst();

                if (!segment) {
                    // Instead of throwing, record the error and continue
                    await trx
                        .insertInto('order_charge_failures')
                        .values({
                            order_id: orderId,
                            reason: 'Error applying charges',
                            details: JSON.stringify({
                                error: 'Segment not found',
                            }),
                            attempted_at: new Date(),
                        })
                        .execute();

                    additionalData.chargeError = 'Charges application failed but order was executed';
                } else {
                    const charges = await trx
                        .selectFrom('brokerage_charges')
                        .innerJoin('charge_types', 'brokerage_charges.charge_type_id', 'charge_types.id')
                        .where('brokerage_charges.segment_id', '=', segment.id)
                        .where((eb) =>
                            eb.or([
                                eb('brokerage_charges.effective_to', 'is', null),
                                eb('brokerage_charges.effective_to', '>=', new Date()),
                            ]),
                        )
                        .where('brokerage_charges.effective_from', '<=', new Date())
                        .select([
                            'brokerage_charges.id as charge_id',
                            'charge_types.id as charge_type_id',
                            'charge_types.name as charge_name',
                            'brokerage_charges.buy_value',
                            'brokerage_charges.sell_value',
                            'brokerage_charges.is_percentage',
                            'brokerage_charges.min_amount',
                            'brokerage_charges.max_amount',
                        ])
                        .execute();

                    // Calculate and save charges for this leg
                    if (charges.length > 0) {
                        let totalLegCharges = 0;
                        let taxableAmount = 0; // For GST calculation

                        for (const charge of charges) {
                            let chargeAmount = 0;
                            const value = order.order_side === OrderSide.BUY ? charge.buy_value : charge.sell_value;

                            // Skip if the charge value is 0
                            if (value === 0) {
                                continue;
                            }

                            // Calculate the charge
                            if (charge.is_percentage) {
                                chargeAmount = (transactionValue * value) / 100;

                                // Apply min/max if needed
                                if (charge.min_amount !== null && chargeAmount < charge.min_amount) {
                                    chargeAmount = charge.min_amount;
                                }

                                if (charge.max_amount !== null && chargeAmount > charge.max_amount) {
                                    chargeAmount = charge.max_amount;
                                }
                            } else {
                                chargeAmount = value;
                            }

                            // GST calculation
                            if (
                                ['BROKERAGE', 'TRANSACTION CHARGES', 'SEBI CHARGES', 'IPFT'].includes(
                                    charge.charge_name,
                                )
                            ) {
                                taxableAmount += chargeAmount;
                            }

                            chargeAmount = parseFloat(chargeAmount.toFixed(2));

                            // Add to total
                            totalLegCharges += chargeAmount;

                            // Record charge for this leg
                            await trx
                                .insertInto('order_charges')
                                .values({
                                    order_id: orderId,
                                    charge_type_id: charge.charge_type_id,
                                    charge_amount: chargeAmount,
                                    is_percentage: charge.is_percentage,
                                    percentage_value: charge.is_percentage ? value : null,
                                    transaction_value: transactionValue,
                                    created_at: new Date(),
                                })
                                .execute();
                        }

                        // Calculate GST on taxable amount
                        const cgstAmount = parseFloat((taxableAmount * 0.09).toFixed(2));
                        const sgstAmount = parseFloat((taxableAmount * 0.09).toFixed(2));

                        totalLegCharges += cgstAmount + sgstAmount;

                        // Add GST charges
                        const cgstType = await trx
                            .selectFrom('charge_types')
                            .where('name', '=', 'CGST')
                            .select(['id'])
                            .executeTakeFirst();

                        const sgstType = await trx
                            .selectFrom('charge_types')
                            .where('name', '=', 'SGST')
                            .select(['id'])
                            .executeTakeFirst();

                        if (cgstType) {
                            await trx
                                .insertInto('order_charges')
                                .values({
                                    order_id: orderId,
                                    charge_type_id: cgstType.id,
                                    charge_amount: cgstAmount,
                                    is_percentage: true,
                                    percentage_value: 9, // 9%
                                    transaction_value: taxableAmount,
                                    created_at: new Date(),
                                })
                                .execute();
                        }

                        if (sgstType) {
                            await trx
                                .insertInto('order_charges')
                                .values({
                                    order_id: orderId,
                                    charge_type_id: sgstType.id,
                                    charge_amount: sgstAmount,
                                    is_percentage: true,
                                    percentage_value: 9, // 9%
                                    transaction_value: taxableAmount,
                                    created_at: new Date(),
                                })
                                .execute();
                        }

                        // Update the order with the leg's charges
                        const existingCharges = await trx
                            .selectFrom('orders')
                            .where('id', '=', orderId)
                            .select(['total_charges'])
                            .executeTakeFirst();

                        const previousCharges = existingCharges?.total_charges || 0;

                        await trx
                            .updateTable('orders')
                            .set({
                                total_charges: previousCharges + totalLegCharges,
                                updated_at: new Date(),
                            })
                            .where('id', '=', orderId)
                            .execute();

                        // Add charges data to the response
                        additionalData.charges = {
                            legCharges: totalLegCharges,
                            totalChargesSoFar: previousCharges + totalLegCharges,
                        };
                    }
                }
            }
        } else {
            // For non-iceberg orders, apply charges to the entire order
            if (!(order.order_category === OrderCategory.ICEBERG && currentLeg)) {
                // Apply charges directly without try/catch
                const chargesResult = await applyOrderCharges(orderId, order.user_id);

                if (chargesResult) {
                    additionalData.charges = {
                        total_charges: chargesResult.total_charges,
                        applied_charges: chargesResult.applied_charges,
                    };
                } else {
                    // Record the error but don't fail the transaction
                    await trx
                        .insertInto('order_charge_failures')
                        .values({
                            order_id: orderId,
                            reason: 'Error applying charges',
                            details: JSON.stringify({
                                error: 'Failed to apply charges',
                            }),
                            attempted_at: new Date(),
                        })
                        .execute();

                    additionalData.chargeError = 'Charges application failed but order was executed';

                    // Log the error for monitoring
                    logger.error('Error applying charges to order: Failed to get charge results');
                }
            }
        }
        return {
            order: updatedOrder,
            ...additionalData,
        };
    });
    res.status(OK).json({
        data: result,
        message: 'Order executed successfully',
    });
};

const executeNextIcebergLeg = async (req: Request, res: Response): Promise<void> => {
    const icebergOrderId: number = parseInt(req.params.icebergOrderId, 10);
    const { executionPrice, exchangeOrderId, remarks }: ExecuteNextLegRequest = req.body;

    if (!executionPrice) {
        throw new BadRequestError('Execution Price is Required');
    }

    const result = await db.transaction().execute(async (trx) => {
        // Get iceberg order details to include product_type
        const icebergOrder = await trx
            .selectFrom('iceberg_orders')
            .where('order_id', '=', icebergOrderId)
            .selectAll()
            .executeTakeFirst();

        if (!icebergOrder) {
            throw new NotFoundError('Iceberg order not found');
        }
        // Get the next queued leg
        const nextLeg = await trx
            .selectFrom('iceberg_legs')
            .where('iceberg_order_id', '=', icebergOrderId)
            .where('status', '=', OrderStatus.QUEUED)
            .orderBy('leg_number', 'asc')
            .selectAll()
            .executeTakeFirst();

        if (!nextLeg) {
            throw new BadRequestError('No more legs to execute for this iceberg order');
        }

        // Update the leg status
        const updatedLeg = await trx
            .updateTable('iceberg_legs')
            .set({
                status: OrderStatus.EXECUTED,
                executed_at: new Date(),
            })
            .where('id', '=', nextLeg.id)
            .returningAll()
            .executeTakeFirst();

        // Using Subquery
        await trx
            .updateTable('iceberg_legs')
            .set({
                status: OrderStatus.QUEUED,
            })
            .where(
                'id',
                '=',
                trx
                    .selectFrom('iceberg_legs')
                    .where('iceberg_order_id', '=', icebergOrderId)
                    .where('leg_number', '>', nextLeg.leg_number)
                    .orderBy('leg_number', 'asc')
                    .select('id')
                    .limit(1),
            )
            .execute();

        // Get the next leg after this one
        const followingLeg = await trx
            .selectFrom('iceberg_legs')
            .where('iceberg_order_id', '=', icebergOrderId)
            .where('leg_number', '>', nextLeg.leg_number)
            .orderBy('leg_number', 'asc')
            .selectAll()
            .executeTakeFirst();

        if (followingLeg) {
            await trx
                .updateTable('iceberg_legs')
                .set({
                    status: OrderStatus.QUEUED, // Set the next leg to queued
                })
                .where('id', '=', followingLeg.id)
                .execute();
        }
        // Create order history record
        await trx
            .insertInto('order_history')
            .values({
                order_id: icebergOrderId,
                previous_status: OrderStatus.EXECUTED, // Order remains executed
                new_status: OrderStatus.EXECUTED, // Order remains executed
                changed_at: new Date(),
                remarks: remarks || `Iceberg leg ${nextLeg.leg_number} executed`,
                changed_by: 'system',
            })
            .execute();

        // Get the order details for applying charges
        const order = await trx.selectFrom('orders').where('id', '=', icebergOrderId).selectAll().executeTakeFirst();

        let chargesData: ChargesData = {};

        // Determine segment based on product type
        const segmentName = icebergOrder.product_type === ProductType.INTRADAY ? 'EQUITY INTRADAY' : 'EQUITY DELIVERY';

        // Calculate transaction value for this leg
        const legTransactionValue = nextLeg.quantity * executionPrice;

        // Get charges configuration
        const segment = await trx
            .selectFrom('market_segments')
            .where('name', '=', segmentName)
            .select(['id'])
            .executeTakeFirst();

        if (!segment || !order) {
            // Recording the error if segment or order is not found
            logger.error('Error applying charges to iceberg leg: Segment or order not found');

            await trx
                .insertInto('order_charge_failures')
                .values({
                    order_id: icebergOrderId,
                    reason: 'Error applying charges to iceberg leg',
                    details: JSON.stringify({
                        legId: nextLeg.id,
                        legNumber: nextLeg.leg_number,
                        error: 'Segment or order not found',
                    }),
                    attempted_at: new Date(),
                })
                .execute();

            chargesData = {
                error: 'Charges application failed but leg was executed',
            };
        } else {
            const charges = await trx
                .selectFrom('brokerage_charges')
                .innerJoin('charge_types', 'brokerage_charges.charge_type_id', 'charge_types.id')
                .where('brokerage_charges.segment_id', '=', segment.id)
                .where((eb) =>
                    eb.or([
                        eb('brokerage_charges.effective_to', 'is', null),
                        eb('brokerage_charges.effective_to', '>=', new Date()),
                    ]),
                )
                .where('brokerage_charges.effective_from', '<=', new Date())
                .select([
                    'brokerage_charges.id as charge_id',
                    'charge_types.id as charge_type_id',
                    'charge_types.name as charge_name',
                    'brokerage_charges.buy_value',
                    'brokerage_charges.sell_value',
                    'brokerage_charges.is_percentage',
                    'brokerage_charges.min_amount',
                    'brokerage_charges.max_amount',
                ])
                .execute();

            if (charges.length > 0) {
                let totalLegCharges = 0;
                let taxableAmount = 0;
                const appliedCharges: any[] = [];

                for (const charge of charges) {
                    let chargeAmount = 0;
                    let value;

                    if (order.order_side === OrderSide.BUY) {
                        value = charge.buy_value;
                    } else {
                        value = charge.sell_value;
                    }

                    if (value === 0) {
                        continue;
                    }

                    if (charge.is_percentage) {
                        chargeAmount = (legTransactionValue * value) / 100;

                        // Apply min/max if needed
                        if (charge.min_amount !== null && chargeAmount < charge.min_amount) {
                            chargeAmount = charge.min_amount;
                        }

                        if (charge.max_amount !== null && chargeAmount > charge.max_amount) {
                            chargeAmount = charge.max_amount;
                        }
                    } else {
                        chargeAmount = value;
                    }

                    if (['BROKERAGE', 'TRANSACTION CHARGES', 'SEBI CHARGES'].includes(charge.charge_name)) {
                        taxableAmount += chargeAmount;
                    }

                    // Round to 2 decimal places
                    chargeAmount = parseFloat(chargeAmount.toFixed(2));

                    // Add to total
                    totalLegCharges += chargeAmount;

                    // Record charge for this leg
                    const savedCharge = await trx
                        .insertInto('order_charges')
                        .values({
                            order_id: icebergOrderId,
                            charge_type_id: charge.charge_type_id,
                            charge_amount: chargeAmount,
                            is_percentage: charge.is_percentage,
                            percentage_value: charge.is_percentage ? value : null,
                            transaction_value: legTransactionValue,
                            created_at: new Date(),
                        })
                        .returningAll()
                        .executeTakeFirst();

                    if (savedCharge) {
                        appliedCharges.push({
                            ...savedCharge,
                            charge_name: charge.charge_name,
                        });
                    }
                }

                // Calculate GST on taxable amount (18% combined)
                const gstAmount = parseFloat((taxableAmount * 0.18).toFixed(2));

                totalLegCharges += gstAmount;

                // Add GST charge
                const gstType = await trx
                    .selectFrom('charge_types')
                    .where('name', '=', 'GST')
                    .select(['id'])
                    .executeTakeFirst();

                if (gstType) {
                    const gstCharge = await trx
                        .insertInto('order_charges')
                        .values({
                            order_id: icebergOrderId,
                            charge_type_id: gstType.id,
                            charge_amount: gstAmount,
                            is_percentage: true,
                            percentage_value: 18, // 18%
                            transaction_value: taxableAmount,
                            created_at: new Date(),
                        })
                        .returningAll()
                        .executeTakeFirst();

                    if (gstCharge) {
                        appliedCharges.push({
                            ...gstCharge,
                            charge_name: 'GST',
                        });
                    }
                }

                // Update order with total charges
                const existingCharges = await trx
                    .selectFrom('orders')
                    .where('id', '=', icebergOrderId)
                    .select(['total_charges'])
                    .executeTakeFirst();

                const previousCharges = existingCharges?.total_charges || 0;

                await trx
                    .updateTable('orders')
                    .set({
                        total_charges: previousCharges + totalLegCharges,
                        updated_at: new Date(),
                    })
                    .where('id', '=', icebergOrderId)
                    .execute();

                chargesData = {
                    legCharges: totalLegCharges,
                    totalChargesSoFar: previousCharges + totalLegCharges,
                    appliedCharges,
                };
            } else {
                // No charges found
                logger.error('Error applying charges to iceberg leg: No charges found for segment');

                await trx
                    .insertInto('order_charge_failures')
                    .values({
                        order_id: icebergOrderId,
                        reason: 'Error applying charges to iceberg leg',
                        details: JSON.stringify({
                            legId: nextLeg.id,
                            legNumber: nextLeg.leg_number,
                            error: 'No charges found for segment',
                        }),
                        attempted_at: new Date(),
                    })
                    .execute();

                chargesData = {
                    error: 'Charges application failed but leg was executed',
                };
            }
        }

        return {
            executedLeg: updatedLeg,
            nextLeg: followingLeg || null,
            hasMoreLegs: !!followingLeg,
            executionPrice,
            exchangeOrderId,
            productType: icebergOrder.product_type,
            charges: chargesData,
        };
    });

    res.status(OK).json({
        data: result,
        message: 'Iceberg order leg executed successfully',
    });
};

// Rejectingt the order

const rejectOrder = async (req: Request, res: Response): Promise<void> => {
    const orderId: number = parseInt(req.params.orderId, 10);
    const { rejectionReason }: RejectOrderRequest = req.body;

    if (!rejectionReason) {
        throw new BadRequestError('Rejection reason is required');
    }

    const result = await db.transaction().execute(async (trx) => {
        // Get order details
        const order = await trx.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst();

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Validate order status
        if (order.status !== OrderStatus.QUEUED) {
            throw new BadRequestError(`Cannot reject order with status "${order.status}"`);
        }

        // Update order status
        const updatedOrder = await trx
            .updateTable('orders')
            .set({
                status: OrderStatus.REJECTED,
                rejected_reason: rejectionReason,
            })
            .where('id', '=', orderId)
            .returningAll()
            .executeTakeFirst();

        // create order-history

        await trx
            .insertInto('order_history')
            .values({
                order_id: orderId,
                previous_status: OrderStatus.QUEUED,
                new_status: OrderStatus.REJECTED,
                changed_at: new Date(),
                remarks: rejectionReason,
                changed_by: 'system',
            })
            .execute();

        // Handle specific order category rejection
        switch (order.order_category) {
            case OrderCategory.ICEBERG:
                // Update all queued legs
                await trx
                    .updateTable('iceberg_legs')
                    .set({
                        status: OrderStatus.REJECTED,
                        rejected_reason: rejectionReason,
                    })
                    .where('iceberg_order_id', '=', orderId)
                    .where('status', '=', OrderStatus.QUEUED)
                    .execute();
                break;

            case OrderCategory.COVER_ORDER:
                // Update cover order details
                await trx
                    .updateTable('cover_order_details')
                    .set({
                        main_order_status: OrderStatus.REJECTED,
                        stop_loss_order_status: OrderStatus.REJECTED,
                    })
                    .where('cover_order_id', '=', orderId)
                    .execute();
                break;
        }

        // Delete any charges that might have been applied
        await trx.deleteFrom('order_charges').where('order_id', '=', orderId).execute();

        // Reset total charges to 0
        await trx
            .updateTable('orders')
            .set({
                total_charges: 0,
            })
            .where('id', '=', orderId)
            .execute();

        return {
            id: orderId,
            status: OrderStatus.REJECTED,
            rejectionReason,
        };
    });
    res.status(OK).json({
        data: result,
        message: 'Order rejected successfully',
    });
};

// Execute Stop-loss order

const executeStopLoss = async (req: Request, res: Response): Promise<void> => {
    const coverOrderId: number = parseInt(req.params.coverOrderId, 10);
    const { executionPrice, exchangeOrderId, remarks }: ExecuteStopLossRequest = req.body;

    if (!executionPrice) {
        throw new BadRequestError('Execution price is required');
    }

    const result = await db.transaction().execute(async (trx) => {
        // Get cover order details
        const coverOrderDetails = await trx
            .selectFrom('cover_order_details')
            .where('cover_order_id', '=', coverOrderId)
            .selectAll()
            .executeTakeFirst();

        if (!coverOrderDetails) {
            throw new NotFoundError('Cover order details not found');
        }

        // Check if main order has been executed
        if (coverOrderDetails.main_order_status !== OrderStatus.EXECUTED) {
            throw new BadRequestError('Cannot execute stop loss for cover order with main order not executed');
        }

        // Check if stop loss is already executed
        if (coverOrderDetails.stop_loss_order_status === OrderStatus.EXECUTED) {
            throw new BadRequestError('Stop loss already executed');
        }

        // Update cover order details
        const updatedCoverOrderDetails = await trx
            .updateTable('cover_order_details')
            .set({
                stop_loss_order_status: OrderStatus.EXECUTED,
                stop_loss_executed_at: new Date(),
                stop_loss_order_id: exchangeOrderId || null,
            })
            .where('cover_order_id', '=', coverOrderId)
            .where((eb) => eb.exists(eb.selectFrom('orders').where('id', '=', coverOrderId).select('id')))
            .returningAll()
            .executeTakeFirstOrThrow();
        // Get the order details for later calculations
        const order = await trx
            .selectFrom('orders')
            .where('id', '=', coverOrderId)
            .selectAll()
            .executeTakeFirstOrThrow();

        // Create order history record
        await trx
            .insertInto('order_history')
            .values({
                order_id: coverOrderId,
                previous_status: OrderStatus.EXECUTED, // Main order was executed
                new_status: OrderStatus.EXECUTED, // Order remains executed, but stop loss is triggered
                changed_at: new Date(),
                remarks: remarks || 'Stop loss executed',
                changed_by: 'system',
            })
            .execute();

        // Apply charges for stop loss order
        let chargesData: ChargesData = {};

        // Cover orders are always intraday
        const segmentName = 'EQUITY INTRADAY';

        // Calculate transaction value for stop loss
        const transactionValue = order.quantity * executionPrice;

        // Get charges configuration
        const segment = await trx
            .selectFrom('market_segments')
            .where('name', '=', segmentName)
            .select(['id'])
            .executeTakeFirst();

        if (!segment) {
            // Log error and record failure
            logger.error(`Error applying charges to stop loss: Segment ${segmentName} not found`);

            await trx
                .insertInto('order_charge_failures')
                .values({
                    order_id: coverOrderId,
                    reason: 'Error applying charges to stop loss',
                    details: JSON.stringify({
                        error: `Segment ${segmentName} not found`,
                    }),
                    attempted_at: new Date(),
                })
                .execute();

            chargesData = {
                error: 'Charges application failed but stop loss was executed',
            };
        } else {
            const charges = await trx
                .selectFrom('brokerage_charges')
                .innerJoin('charge_types', 'brokerage_charges.charge_type_id', 'charge_types.id')
                .where('brokerage_charges.segment_id', '=', segment.id)
                .where((eb) =>
                    eb.or([
                        eb('brokerage_charges.effective_to', 'is', null),
                        eb('brokerage_charges.effective_to', '>=', new Date()),
                    ]),
                )
                .where('brokerage_charges.effective_from', '<=', new Date())
                .select([
                    'brokerage_charges.id as charge_id',
                    'charge_types.id as charge_type_id',
                    'charge_types.name as charge_name',
                    'brokerage_charges.buy_value',
                    'brokerage_charges.sell_value',
                    'brokerage_charges.is_percentage',
                    'brokerage_charges.min_amount',
                    'brokerage_charges.max_amount',
                ])
                .execute();

            // Calculate charges for stop loss
            if (charges.length === 0) {
                // Log error and record failure
                logger.error('Error applying charges to stop loss: No charges found for segment');

                await trx
                    .insertInto('order_charge_failures')
                    .values({
                        order_id: coverOrderId,
                        reason: 'Error applying charges to stop loss',
                        details: JSON.stringify({
                            error: 'No charges found for segment',
                        }),
                        attempted_at: new Date(),
                    })
                    .execute();

                chargesData = {
                    error: 'Charges application failed but stop loss was executed',
                };
            } else {
                let totalStopLossCharges = 0;
                let taxableAmount = 0;
                const appliedCharges: any[] = [];

                // Always use 'sell' for stop loss since it closes the position
                const orderSide = OrderSide.SELL;

                for (const charge of charges) {
                    let chargeAmount = 0;
                    const value = charge.sell_value;

                    // Skip if the charge value is 0
                    if (value === 0) {
                        continue;
                    }

                    // Calculate the charge
                    if (charge.is_percentage) {
                        chargeAmount = (transactionValue * value) / 100;

                        // Apply min/max if needed
                        if (charge.min_amount !== null && chargeAmount < charge.min_amount) {
                            chargeAmount = charge.min_amount;
                        }

                        if (charge.max_amount !== null && chargeAmount > charge.max_amount) {
                            chargeAmount = charge.max_amount;
                        }
                    } else {
                        chargeAmount = value;
                    }

                    // For GST calculation
                    if (['BROKERAGE', 'TRANSACTION CHARGES', 'SEBI CHARGES'].includes(charge.charge_name)) {
                        taxableAmount += chargeAmount;
                    }

                    // Round to 2 decimal places
                    chargeAmount = parseFloat(chargeAmount.toFixed(2));

                    // Add to total
                    totalStopLossCharges += chargeAmount;

                    // Record charge for stop loss
                    const savedCharge = await trx
                        .insertInto('order_charges')
                        .values({
                            order_id: coverOrderId,
                            charge_type_id: charge.charge_type_id,
                            charge_amount: chargeAmount,
                            is_percentage: charge.is_percentage,
                            percentage_value: charge.is_percentage ? value : null,
                            transaction_value: transactionValue,
                            created_at: new Date(),
                        })
                        .returningAll()
                        .executeTakeFirst();

                    if (savedCharge) {
                        appliedCharges.push({
                            ...savedCharge,
                            charge_name: charge.charge_name,
                        });
                    }
                }

                // Calculate GST on taxable amount (18% combined instead of separate CGST and SGST)
                const gstAmount = parseFloat((taxableAmount * 0.18).toFixed(2));

                totalStopLossCharges += gstAmount;

                // Add GST charge
                const gstType = await trx
                    .selectFrom('charge_types')
                    .where('name', '=', 'GST')
                    .select(['id'])
                    .executeTakeFirst();

                if (gstType) {
                    const gstCharge = await trx
                        .insertInto('order_charges')
                        .values({
                            order_id: coverOrderId,
                            charge_type_id: gstType.id,
                            charge_amount: gstAmount,
                            is_percentage: true,
                            percentage_value: 18, // 18%
                            transaction_value: taxableAmount,
                            created_at: new Date(),
                        })
                        .returningAll()
                        .executeTakeFirst();

                    if (gstCharge) {
                        appliedCharges.push({
                            ...gstCharge,
                            charge_name: 'GST',
                        });
                    }
                } else {
                    // Log error if GST charge type not found
                    logger.error('Error applying GST charge: GST charge type not found');
                }

                // Update order with total charges
                const existingCharges = await trx
                    .selectFrom('orders')
                    .where('id', '=', coverOrderId)
                    .select(['total_charges'])
                    .executeTakeFirst();

                const previousCharges = existingCharges?.total_charges || 0;

                await trx
                    .updateTable('orders')
                    .set({
                        total_charges: previousCharges + totalStopLossCharges,
                        updated_at: new Date(),
                    })
                    .where('id', '=', coverOrderId)
                    .execute();

                chargesData = {
                    stopLossCharges: totalStopLossCharges,
                    totalChargesSoFar: previousCharges + totalStopLossCharges,
                    appliedCharges,
                };
            }
        }

        return {
            coverOrderDetails: updatedCoverOrderDetails,
            executionPrice,
            exchangeOrderId,
            charges: chargesData,
        };
    });
    if (!result) {
        logger.error('Error executing stop loss: Transaction failed');
    }
    res.status(OK).json({
        success: true,
        data: result,
        message: 'Stop loss executed successfully',
    });
};

// Get Order Charges

const getOrderCharges = async (req: Request, res: Response): Promise<void> => {
    const orderId: number = parseInt(req.params.orderId, 10);

    // First check if the order exists
    const order = await db.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst();

    if (!order) {
        throw new NotFoundError('Order not found');
    }

    // Only executed orders can have charges
    if (order.status !== OrderStatus.EXECUTED) {
        throw new BadRequestError('Charges are only applicable for executed orders');
    }

    // Get charges for this order
    const charges = await db
        .selectFrom('order_charges')
        .innerJoin('charge_types', 'order_charges.charge_type_id', 'charge_types.id')
        .where('order_charges.order_id', '=', orderId)
        .select([
            'order_charges.id',
            'charge_types.name as charge_name',
            'charge_types.description as charge_description',
            'order_charges.charge_amount',
            'order_charges.is_percentage',
            'order_charges.percentage_value',
            'order_charges.transaction_value',
            'order_charges.created_at',
        ])
        .execute();
    const totalCharges =
        order.total_charges || charges.reduce((sum, charge) => sum + parseFloat(charge.charge_amount.toString()), 0);

    res.status(OK).json({
        data: {
            order_id: orderId,
            status: order.status,
            symbol: order.symbol,
            quantity: order.quantity,
            price: order.price,
            order_side: order.order_side,
            order_category: order.order_category,
            total_charges: totalCharges,
            transaction_value: order.quantity * (order.price || 0),
            charges_breakdown: charges,
        },
    });
};

export default {
    executeOrder,
    executeNextIcebergLeg,
    rejectOrder,
    executeStopLoss,
    getOrderCharges,
};
