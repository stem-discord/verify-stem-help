/**
 * Created by the STEM discord team 
 * @license LGPL-3.0
 */

const express = require('express');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const Recaptcha = require('express-recaptcha').RecaptchaV2;

const Util = require('./Util');

const logger = Util.getLogger();

class Server {

    /**
     * @param {object} data
     * @param {BouncerBot} data.bot
     * @param {number} data.port
     * @param {object} data.recaptcha
     * @param {string} data.recaptcha.siteKey
     * @param {string} data.recaptcha.secretKey
     * @param {string} data.viewDir
     * @param {JsonDictionary} data.verificationDict
     */
    constructor(data) {
        this._bot = data.bot;
        this._port = data.port;
        this._recaptcha = data.recaptcha;
        this._viewDir = data.viewDir;
        this._verificationDict = data.verificationDict;

        this._setupExpress();
    }

    _setupExpress() {
        const app = express();
        const recaptcha = new Recaptcha(this._recaptcha.siteKey, this._recaptcha.secretKey, {callback: 'callback'});

        app.engine('hbs', exphbs({defaultLayout: null}));
        app.set('view engine', 'hbs');
        app.set('views', this._viewDir);
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({extended: true}));

        app.get('/', (req, res) => {
            res.render('index');
        });

        app.get('/verify/:banId?', (req, res) => {
            const {banId} = req.params;
            if (!banId) {
                res.status(400);
                return res.render('error', {
                    title: 'No ban ID specified',
                    text: 'Make sure you use a valid verification link.',
                });
            }

            const ban = this._verificationDict.get(banId);
            if (!ban) {
                res.status(404);
                return res.render('error', {
                    title: 'Invalid ban ID',
                    text: `Ban with ID <strong>${banId}</strong> could not be found.`,
                });
            }

            res.render('verify', {
                banId,
                userTag: ban.userTag,
                captcha: recaptcha.render(),
            });
        });

        app.post('/verify/:banId?', recaptcha.middleware.verify, (req, res) => {
            const {banId} = req.params;
            if (!banId) {
                res.status(400);
                return res.send({error: 'No ban ID specified'});
            }

            const ban = this._verificationDict.get(banId);
            if (!ban) {
                res.status(404);
                return res.send({error: 'Invalid ban ID'});
            }

            if (!req.recaptcha.error) {
                this._bot.attemptVerification({banId})
                    .then(() => {
                        res.status(200);
                        return res.send({});
                    })
                    .catch(error => {
                        res.status(500);
                        return res.send({error: error.message});
                    });
            } else {
                res.status(401);
                return res.send({error: 'Captcha verification failed'});
            }
        });

        app.get('*', (req, res) => {
            res.status(404);
            return res.render('error', {
                title: 'Page not found',
                text: `The requested page does not exist.`,
            });
        });

        this.app = app;
    }

    start() {
        return new Promise(resolve => {
            this.app.listen(this._port, () => {
                logger.info(`Server listening on port ${this._port}.`);
                resolve();
            });
        });
    };

}

module.exports = Server;
