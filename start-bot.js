/**
 * Created by the STEM discord team 
 * @license LGPL-3.0
 */

const path = require('path');

const config = require('./config');
const Logger = require('./lib/Logger');
const StemShield = require('./lib/StemShield');

const dataDir = path.join(__dirname, 'data');
const bot = new StemShield({...config, dataDir});

bot.start()
    .catch(error => Logger.error(error));
