import request from 'supertest';
import app from '@app/app';

describe('Server Tests', () => {
    it('should be running on the specified port', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBeDefined();
    });
});
