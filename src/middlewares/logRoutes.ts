import { Application, Router } from 'express';
import { IRoute, ILayer } from 'express-serve-static-core';

const logRoutes = (app: Application) => {
    if (!app._router) {
        console.error('No routes found on the app.');
        return;
    }

    app._router.stack.forEach((middleware: { route?: any; name?: string; handle?: Router }) => {
        if (middleware.route) {
            const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
            console.log(`${methods} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
            middleware.handle?.stack.forEach((handler: ILayer) => {
                if (handler.route) {
                    const route = handler.route as unknown as { [key: string]: boolean };
                    const methods = Object.keys(route).join(', ').toUpperCase();
                    console.log(`${methods} ${(handler.route as IRoute<string>).path}`);
                }
            });
        }
    });
};

export default logRoutes;
