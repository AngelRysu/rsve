const nodemailer = require('nodemailer');

class Mailer {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.MAIL_USER,
                clientId: process.env.MAIL_ID,
                clientSecret: process.env.MAIL_SECRET,
                refreshToken: process.env.MAIL_TOKEN
            }
        });
    }

    async enviarCorreo(destinatario, asunto, contenido) {
        const mailOptions = {
            from: process.env.MAIL_USER,
            to: destinatario,
            subject: asunto,
            html: contenido
        };

        try {
            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error("Error sending email:", error);
        }
    }
}

module.exports = Mailer;
