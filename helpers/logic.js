/**
 * Main bot logic that handles incoming messages and routes logic to helpers files
 *
 * @module helpers/logic
 * @license MIT
 */

/** Dependencies */
const hourlyRatePicker = require('./hourlyRatePicker');
const categoryPicker = require('./categoryPicker');
const adminPanel = require('./adminCommands');
const jobManager = require('./jobManager');
const keyboards = require('./keyboards');
const dbmanager = require('./dbmanager');
const profile = require('./profile');
const strings = require('./strings');
const check = require('./messageParser');
const bot = require('./telegramBot');

/** Handle messages */

/**
 * Fired when bot receives a message
 *
 * @param {Telegram:Message} msg - Message received by bot
 */
bot.on('message', (msg) => {
  if (!msg) return;
  else if (!msg.from.username) {
    profile.sendAskForUsername(bot, msg);
    return;
  }

  profile.textInputCheck(msg, (isTextInput, user) => {
    if (user) {
      if (user.ban_state) {
        profile.sendBanMessage(bot, msg);
        return;
      }

      profile.updateProfile(msg, user);

      if (isTextInput) {
        eventEmitter.emit(((msg.text === strings.cancel) ? 'cancel' : '') + isTextInput, { msg, user, bot });
      } else {
        if (check.replyMarkup(msg)) {
          handleKeyboard(msg);
        }
        else {
          if (check.botCommandStart(msg)) {
            keyboards.sendMainMenu(bot, msg.chat.id, false);
          } else {
            console.log(msg);
          }
        }
      }
    } else if (check.botCommandStart(msg)) {
      profile.createProfile(bot, msg);
    } else if (check.adminCommand(msg)) {
      adminPanel.handleAdminCommand(msg, bot);
    }
  });
});

/**
 * Fired when user clicks button on inlline keyboard
 *
 * @param {Telegram:Message} msg - Message that gets passed from user and info about button clicked
 */
bot.on('callback_query', msg => {
  if (!msg.from.username) {
    profile.sendAskForUsername(msg);
    return;
  }

  dbmanager.findUser({ id: msg.from.id })
    .then((user) => {
      if (user.ban_state) {
        profile.sendBanMessage(msg);
        return;
      }

      const options = msg.data.split(strings.inlineSeparator);
      const inlineQuery = options[0];
      eventEmitter.emit(inlineQuery, { msg, bot });
    });
});

bot.on('inline_query', (msg) => {
  dbmanager.findUser({ id: msg.from.id })
    .then((user) => {
      const results = [{
        type: 'article',
        id: `${GetRandomInt(1000000000000000, 999999999999999999)}`,
        title: strings.shareProfile,
        input_message_content : {
          message_text: user.GetTextToShareProfile(),
        },
      }];

      const opts = {
        cache_time: 60,
        is_personal: true,
      };

      bot.answerInlineQuery(msg.id, results, opts)
        .then((msg2) => { })
        .catch((ex) => { console.error(ex); });
    })
    .catch((err) => { console.error(err.message); });
});

/**
 * Handler for custom keyboard button clicks
 *
 * @param {Telegram:Message} msg - Message that is passed with click and keyboard option
 */
function handleKeyboard(msg) {
  const text = msg.text;
  const mainMenuOptions = strings.mainMenuOptions;
  const clientOptions = strings.clientMenuOptions;
  const freelanceMenuOptions = strings.freelanceMenuOptions;

  // Check main menu
  if (text === mainMenuOptions.findJobs) {
    keyboards.sendFreelanceMenu(bot, msg.chat.id);
  } else if (text === mainMenuOptions.findContractors) {
    keyboards.sendClientMenu(bot, msg.chat.id);
  } else if (text === mainMenuOptions.help) {
    keyboards.sendHelp(bot, msg.chat.id);
  }
  // Check client menu
  else if (text === clientOptions.postNewJob) {
    jobManager.askForNewJobCategory(msg, bot);
  } else if (text === clientOptions.myJobs) {
    jobManager.sendAllJobs(bot, msg);
  }
  // Check freelance menu
  else if (text === freelanceMenuOptions.editBio || text === freelanceMenuOptions.addBio) {
    profile.askForBio(msg, bot);
  } else if (text === freelanceMenuOptions.editCategories || text === freelanceMenuOptions.addCategories) {
    categoryPicker.sendCategories(bot, msg.chat.id);
  } else if (text === freelanceMenuOptions.editHourlyRate || text === freelanceMenuOptions.addHourlyRate) {
    hourlyRatePicker.sendHourlyRate(bot, msg.chat.id);
  } else if (text === freelanceMenuOptions.busy || text === freelanceMenuOptions.available) {
    profile.toggleAvailability(bot, msg.chat.id);
  }
  // Check back button
  else if (text === freelanceMenuOptions.back) {
    keyboards.sendMainMenu(bot, msg.chat.id);
  }
}


/** Helpers */

/**
 * Get random int
 *
 * @method GetRandomInt
 * @param {Number} min
 * @param {Number} max
 * @return {Number} Random number
 */
function GetRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
