import requestIp from 'request-ip';
import { UAParser } from 'ua-parser-js';
import { Request } from 'express';
import logger from '@app/logger';
import axios from 'axios';

export interface DeviceInfo {
    ip: string;
    location: {
        country?: string;
        region?: string;
        city?: string;
    };
    device: {
        browser?: string;
        device?: string;
        deviceType?: string;
        userAgent: string;
    };
    timestamp: Date;
}

export class DeviceTrackingService {
    private readonly IPINFO_TOKEN = process.env.IPINFO_TOKEN;

    public async getDeviceInfo(req: Request): Promise<DeviceInfo> {
        try {
            const clientIp = this.extractClientIp(req);
            const deviceDetails = this.parseUserAgent(req.get('User-Agent') || '');
            const locationInfo = await this.getLocationFromIp(clientIp);

            const deviceInfo: DeviceInfo = {
                ip: clientIp,
                location: locationInfo,
                device: deviceDetails,
                timestamp: new Date(),
            };

            logger.debug('Device info extracted', {
                ip: deviceInfo.ip,
                country: deviceInfo.location.country,
                location: deviceInfo.location,
                browser: deviceInfo.device.browser,
            });

            return deviceInfo;
        } catch (error) {
            logger.error('Error extracting device info:', error);

            // Return minimal info on error
            return {
                ip: 'unknown',
                location: {},
                device: {
                    userAgent: req.get('User-Agent') || 'unknown',
                },
                timestamp: new Date(),
            };
        }
    }
    /**
     * Extract real client IP considering various proxy configurations
     */

    private extractClientIp(req: Request): string {
        let ip = requestIp.getClientIp(req);

        if (ip && ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
            logger.debug(`Cleaned IPv6-wrapped IP: ${requestIp.getClientIp(req)} → ${ip}`);
        }

        if (ip === '::1') {
            ip = '127.0.0.1';
        }
        if (!ip || ip === '127.0.0.1') {
            // Check various headers in order of reliability
            const headers = [
                'cf-connecting-ip', // CloudFlare
                'x-forwarded-for', // Standard proxy header
                'x-real-ip', // Nginx proxy
                'x-client-ip', // Apache proxy
                'x-forwarded', // Alternative
                'forwarded-for', // Alternative
                'forwarded', // RFC 7239
            ];
            for (const header of headers) {
                const headerValue = req.get(header);
                if (headerValue) {
                    let firstIp = headerValue.split(',')[0].trim();

                    if (firstIp.startsWith('::ffff:')) {
                        firstIp = firstIp.substring(7);
                    }

                    if (this.isValidIp(firstIp)) {
                        return firstIp;
                    }
                }
            }

            // Final fallback
            return req.ip || 'unknown';
        }

        return ip;
    }

    /**
     * Parse user agent string to extract device information
     */
    private parseUserAgent(userAgent: string) {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        return {
            browser: result.browser.name,
            device: result.device.model || result.device.vendor || 'Unknown',
            deviceType: result.device.type || 'desktop',
            userAgent,
        };
    }

    /**
     * Get geographical information from IP address
     */
    private async getLocationFromIp(ip: string): Promise<DeviceInfo['location']> {
        // Handle localhost/private IPs
        if (!this.isValidIp(ip) || ip === 'unknown') {
            return {
                country: 'Local',
                region: 'Local',
                city: 'Local',
            };
        }

        try {
            logger.debug(`Looking up location for IP: ${ip} using ipinfo.io`);

            // Use the standard API (supports both with/without token)
            const url = this.IPINFO_TOKEN
                ? `https://ipinfo.io/${ip}?token=${this.IPINFO_TOKEN}`
                : `https://ipinfo.io/${ip}/json`;

            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Sapphire-Backend/1.0',
                },
            });

            const data = response.data;

            logger.debug(`IPinfo.io response:`, data);

            const result = {
                country: data.country || 'Unknown',
                region: data.region || 'Unknown',
                city: data.city || 'Unknown',
            };

            logger.debug(`Final location result:`, result);
            return result;
        } catch (error: any) {
            logger.error(` Error getting location from ipinfo.io for IP ${ip}:`);

            // Fallback: try without token if token request failed
            if (this.IPINFO_TOKEN && error.response?.status === 401) {
                logger.warn('Token failed, trying without token...');
                try {
                    const fallbackResponse = await axios.get(`https://ipinfo.io/${ip}/json`, {
                        timeout: 5000,
                        headers: {
                            Accept: 'application/json',
                            'User-Agent': 'Sapphire-Backend/1.0',
                        },
                    });

                    const fallbackData = fallbackResponse.data;
                    return {
                        country: fallbackData.country || 'Unknown',
                        region: fallbackData.region || 'Unknown',
                        city: fallbackData.city || 'Unknown',
                    };
                } catch (fallbackError: any) {
                    logger.error('Fallback request also failed:', fallbackError.message);
                }
            }

            return {
                country: 'Unknown',
                region: 'Unknown',
                city: 'Unknown',
            };
        }
    }
    /**
     * Validate IP address format
     */
    private isValidIp(ip: string): boolean {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    /**
     * Format location string for display/logging
     */
    public formatLocationString(location: DeviceInfo['location']): string {
        const parts = [location.city, location.region, location.country].filter((part) => part && part !== 'Unknown');

        return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
    }
    /**
     * Format device string for display/logging
     */
    public formatDeviceString(device: DeviceInfo['device']): string {
        const browser = device.browser || 'Unknown Browser';
        const deviceType = device.deviceType || 'Unknown Device';
        const deviceName = device.device || 'Unknown Model';

        return `${browser} on ${deviceName} (${deviceType})`;
    }
}

export default new DeviceTrackingService();
