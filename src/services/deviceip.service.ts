import requestIp from 'request-ip';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { Request } from 'express';
import logger from '@app/logger';

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
    public getDeviceInfo(req: Request): DeviceInfo {
        try {
            const clientIp = this.extractClientIp(req);
            const deviceDetails = this.parseUserAgent(req.get('User-Agent') || '');
            const locationInfo = this.getLocationFromIp(clientIp);

            const deviceInfo: DeviceInfo = {
                ip: clientIp,
                location: locationInfo,
                device: deviceDetails,
                timestamp: new Date(),
            };

            logger.debug('Device info extracted', {
                ip: deviceInfo.ip,
                country: deviceInfo.location.country,
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

                    // Clean IPv6 wrapper from header values too
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
    private getLocationFromIp(ip: string) {
        if (!this.isValidIp(ip) || ip === 'unknown') {
            return {};
        }

        try {
            const geo = geoip.lookup(ip);

            if (!geo) {
                return { country: 'Unknown' };
            }

            return {
                country: geo.country || 'Unknown',
                region: geo.region || 'Unknown',
                city: geo.city || 'Unknown',
            };
        } catch (error) {
            logger.warn('Error getting location from IP:', error);
            return { country: 'Unknown' };
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
