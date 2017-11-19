/***************************************************************************************************************************
 * @license                                                                                                                *
 * Copyright 2017 Coinbase, Inc.                                                                                           *
 *                                                                                                                         *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance          *
 * with the License. You may obtain a copy of the License at                                                               *
 *                                                                                                                         *
 * http://www.apache.org/licenses/LICENSE-2.0                                                                              *
 *                                                                                                                         *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on     *
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the                      *
 * License for the specific language governing permissions and limitations under the License.                              *
 ***************************************************************************************************************************/

/* This is provided with absolutely no warrenty of any kind.
 * I recommend only giving it API keys that have access to view, absolutely nothing else.
 * Right now it only reports on full fills. I don't trade with large enough amounts that I've
 * ever had a problem with this.
 * Enjoy ~ mustyoshi
 */
 
// Import everything, I've only tested and run this on an ubuntu VPS
const GTT = require('gdax-trading-toolkit');
const program = require('commander');
const getSubscribedFeeds = GTT.Factories.GDAX.getSubscribedFeeds;
const ConsoleLoggerFactory = GTT.utils.ConsoleLoggerFactory;
const GDAXFeed = GTT.Exchanges.GDAXFeed;
const GDAXAPI = GTT.Factories.GDAX.DefaultAPI;

const sendmail = require('sendmail')({ silent: true });

program
.option('--api [value]', 'API url', 'https://api.gdax.com')
.option('--ws [value]', 'WSI url', 'wss://ws-feed.gdax.com')
.option('-p --product [value]', 'The GDAX product to query', 'BTC-USD')
.parse(process.argv);

const wsURL = program.ws;
const apiURL = program.api;
const product = program.product;
const logger = ConsoleLoggerFactory();

// Put in your own personal information here
// I recommend only giving it the view permissions
const authF = {
    key: '',
    secret: '',
    passphrase: ''
};
const pairs = ["ETH-BTC", "LTC-BTC", "ETH-USD", "BTC-USD", "LTC-USD"];
const fromEmail = "your@email.here"
const toEmail = "other@email.here"

let activeTrades = {};
let partialTrades = {};

const options = {
    wsUrl: wsURL,
    apiUrl: apiURL,
    channels: ['user'],
    logger: console,
    auth: authF
};

// Create the API object and give it our auth info
let gdax = new GDAXAPI();
gdax.auth = authF;
console.log(gdax);

// Read in all the existing orders so we can match them up as they fill
gdax.loadAllOrders().then((orders) => {
    orders.forEach((o) => {
        console.log('Added', o.side, 'in', o.productId);
        activeTrades[o.id] = o;
    });
});

// Since I'm in America I only care about the USD pairs.
getSubscribedFeeds(options, pairs ).then((feed) => {
    feed.on('data', (msg) => {
        if (msg.type == 'myOrderPlaced') {
            activeTrades[msg.orderId] = msg;
        } else if (msg.type == 'tradeFinalized' && parseFloat(msg.remainingSize) == 0.0) {

            let toSend = '';
            // Super awesome coding skills, wrapping everything in a try block
            try {
            
                trade = activeTrades[msg.orderId];
                // You can obviously change this to fill your needs. It tells you the size of the trade, and then the equiv amount in USD.
                toSend = msg.productId + ": " + msg.side + " filled for " + parseFloat(trade.size) + " @ " + parseFloat(trade.price) + " = " + parseFloat((parseFloat(trade.size) * parseFloat(trade.price)).toFixed(8)) + " " + msg.productId.substr((4) * (msg.side == 'sell'), 3);
                
                // Get the USD amount
                gdax.loadMidMarketPrice(msg.productId.substr(0, 3) + '-USD').then((price) => {
                    let amt = parseFloat(price)*parseFloat(trade.size);
                    toSend = toSend + ' >> ' + amt.toFixed(2) + 'USD'
                    console.log(toSend);
                    delete activeTrades[msg.orderId];
                    // Send to your recipient. This might fail if you don't have a correctly configured email server
                    sendmail({
                        from: fromEmail,
                        to: toEmail,
                        html: toSend
                    }, function(err, reply) {

                    });
                });
            } catch (e) {
            }
        } else {

        }
    });
}).catch((err) => {
    logger.log('error', err.message);
    process.exit(1);
});