const axios = require('axios');
const fs = require("fs");
const { Heap } = require('heap-js');
require('dotenv').config();

//fucntion to get price of all NSE stocks using an API
async function fetchPrice(){
    const options = {
      method: 'GET',
      url: 'https://latest-stock-price.p.rapidapi.com/any',
      headers: {
        'X-RapidAPI-Key': process.env.RapidAPIKey,
        'X-RapidAPI-Host': 'latest-stock-price.p.rapidapi.com'
      }
    };
    while(true){
      try {
        const response = await axios.request(options);
        const responseData = response.data; 
        if (responseData) {
          const jsonData = JSON.stringify(responseData, null, 2);
          return jsonData;
        } else {
            throw new Error(`API call succeeded, but response was empty.Retrying`);
        }
        
      } catch (error) {
         logErrorToFile(`API call failed: ${error.message}`);
      }
  }
  
}

//fucntion to calculate the most gaining stocks
async function findMostGainingStocks(stockData) {
  const mostGainingStocks = [];
  const gainersHeap = new Heap((a, b) => a.pChange - b.pChange); 
  
  for (const stockItem of stockData) {
    const symbol = stockItem.symbol;
    const pChange = stockItem.pChange;
    gainersHeap.push({ pChange, symbol }); // Insert {pChange, symbol} into the min heap
  }

  while(gainersHeap.size()>5){
    gainersHeap.pop();
  }

  while(!gainersHeap.isEmpty()){
    const { pChange, symbol } = gainersHeap.peek();
    mostGainingStocks.push([symbol,pChange]);
    gainersHeap.pop();
  }
  return mostGainingStocks;
}
// function to calculate the most losing stocks
async function findMostLosingStocks(stockData) {
  const mostLosingStocks = [];
  const losersHeap = new Heap((a, b) => a.pChange - b.pChange); 
  
  for (const stockItem of stockData) {
    let symbol = stockItem.symbol;
    let pChange = stockItem.pChange;
    pChange = pChange * (-1);
    if(pChange > 0)
    losersHeap.push({ pChange, symbol });
  }
  while(losersHeap.size()>5){
    losersHeap.pop();
  }
  while(!losersHeap.isEmpty()){
    let { pChange, symbol } = losersHeap.peek();
    pChange = pChange * (-1);
    mostLosingStocks.push([symbol,pChange]);
    losersHeap.pop();
  }
  return mostLosingStocks;
}

// support function to send message in the telegram group.
const sendMessage = async (text) => {
  const botToken = process.env.TelegramBotToken;// Replace with your bot's API token
  const chatId = process.env.TelegramChatId; // Replace with the chat ID of your group
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });

  const data = await response.json();
  return data;
};

//Function to send the message to telegram group using a bot.
async function sendToTelegram(mostGainingStocks,mostLosingStocks,data){
  let message = "MOST GAINING STOCKS OF THE HOUR\n";
  for (const [symbol,change] of mostGainingStocks) {
    message += `${symbol}: ${change}\n`;
  }
  message += "\n MOST LOSING STOCKS OF THE HOUR\n";
  for (const [symbol,change] of mostLosingStocks) {
    message += `${symbol}: ${change}\n`;
  }

  try {
      message += "time = " + data[0].lastUpdateTime;
  } catch (error) {
      logErrorToFile(`Error API Data is corrupted: ${error.message}`);
  }

  await sendMessage(message).then((result) => {
      // console.log("Message Sent Successfully => "+i);
  }).catch(error => {
      // Log the error to a file
      logErrorToFile(`Error sending message: ${error.message}`);
  });

}

// Used to delay for specific time (60 mins for this case => 3600,000)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Controller function which calls all functions in order.
async function functionHandler(){
  const olddata =  await fetchPrice();
  const data = await JSON.parse(olddata);
  const mostGainingStocks =  await findMostGainingStocks(data);
  const mostLosingStocks =  await findMostLosingStocks(data);
  
  await sendToTelegram(mostGainingStocks,mostLosingStocks,data);
}

// function to log errors to a seperate file
function logErrorToFile(errorMessage) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] => ${errorMessage}\n`;

  fs.appendFile('error.log', logMessage, err => {
      if (err) {
          console.error('Error writing to error file:', err);
      }
  });
}
async function main(i) {
  await functionHandler();
  await sleep(1000);
  await main(i + 1);
}
main(0);