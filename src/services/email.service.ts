import nodemailer from 'nodemailer';
import { env } from '@app/env';

const transporter = nodemailer.createTransport({
    host: env.email.host,
    port: Number(env.email.port),
    secure: env.email.secure,
    auth: {
        user: env.email.user,
        pass: env.email.password,
    },
});

export default transporter;
