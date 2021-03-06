/**
 * Mongo DB manager – used for all the requests to database;
 * Ideally mongoose should be required only here.
 *
 * @module halpers/dbmanager
 * @license MIT
 */

/** Dependencies */
const mongoose = require('mongoose');
const strings = require('./strings');

/** Get schemas **/
const User = mongoose.model('user');
const Category = mongoose.model('category');
const Job = mongoose.model('job');
const Review = mongoose.model('review');
// @todo: functions to access reports
const Report = mongoose.model('report');
const UserChatInline = mongoose.model('userChatInline');

/** User */

/** Makes no population. To save memory */
function getAllUsers() {
  return new Promise((fullfill) => {
    User.find({})
      .populate(['reviews'])
      .exec((err, users) => {
        if (err) throw err;
        else fullfill(users);
      });
  });
}

/**
 * Getting a user with search querry from mongo db, populates 'categories', 'jobs' and 'job_draft'
 *
 * @param  {Mongo:SearchQuery} query - Search query to find user
 */
function findUser(query) {
  return new Promise((fullfill) => {
    User.findOne(query)
      .populate([
        'categories',
        'jobs',
        'job_draft',
        'reviews',
        {
          path: 'jobs',
          populate: {
            path: 'category',
            model: 'category',
          },
        },
        {
          path: 'job_draft',
          populate: {
            path: 'category',
            model: 'category',
          },
        },
      ])
      .exec((err, user) => {
        if (err) throw err;
        else fullfill(user);
      });
  });
}

/**
 * Get user from mongo by id, populates 'categories', 'jobs' and 'job_draft'
 *
 * @param  {Mongo:ObjectId} id - User id from mongo db
 */
function findUserById(id) {
  return new Promise((fullfill) => {
    User.findById(id)
      .populate(['categories', 'jobs', 'job_draft', 'reviews', 'reports'])
      .exec((err, user) => {
        if (err) throw err;
        else if (!user) throw new Error('No user found');
        else fullfill(user);
      });
  });
}

/**
 * Add user object to mongo db;
 * Returns existing user if user with the same 'id' field exists
 * Or creates a new one from user parameter.
 *
 * @param {Object} user - Javascript object with fields for new user
 */
function addUser(user) {
  return new Promise((fullfill) => {
    findUser({ id: user.id })
      .then((dbuserObject) => {
        if (dbuserObject) fullfill({ user: dbuserObject, new: false });
        else {
          const userObject = new User(user);

          userObject.save()
            .then((user) => {
              fullfill({ user, new: true });
            });
        }
      });
  });
}

/**
 * Changes user's busy field to true or false
 *
 * @param  {Number} chatId - Chat id of user that should have busy status toggled
 */
function toggleUserAvailability(chatId) {
  return new Promise((fullfill) => {
    findUser({ id: chatId })
      .then((user) => {
        user.busy = !user.busy;
        user.save()
          .then(fullfill);
      });
  });
}

/**
 * Adds or removes user to or from the specified category;
 * Promise returns {
 *   user: user object,
 *   isAdded: true/false if category was added ot removed
 * }
 *
 * @param  {Number} chatId - Chat id of user that should have category added\removed
 * @param  {Mongo:ObjectId} categoryId - Id of category that should be added\removed to\from user
 */
function toggleCategoryForUser(chatId, categoryId) {
  return new Promise((fullfill) => {
    findUser({ id: chatId })
      .then((user) => {
        Category.findById(categoryId)
          .then((category) => {
            const index = user.categories.map(
              category => String(category._id)
            ).indexOf(String(category.id));

            if (index < 0) {
              user.categories.push(category);
              category.freelancers.push(user);
            } else {
              user.categories.splice(index, 1);
              category.freelancers.splice(category.freelancers.map(
                id => String(id)
              ).indexOf(String(user._id)), 1);
            }

            user.save()
              .then((user) => {
                category.save()
                  .then((category) => {
                    fullfill({ user: user, isAdded: index < 0 });
                  });
              });
          });
      });
  });
}

/**
 * @todo fix it comment;
 *
 * Returns number of users registered
 */
function userCount() {
  return new Promise((fullfill, reject) => {
    User.count({}, (err, c) => {
      if (err) throw err;
      else fullfill(c);
    });
  });
}

/**
 * @todo fix it comment;
 *
 * Returns number of freelancers registered
 */
function freelancerCount() {
  const options = {
    busy: false,
    ban_state: false,
    categories: { $exists: true, $ne: [] },
    bio: { $exists: true },
    hourly_rate: { $exists: true },
  };

  return new Promise((fullfill, reject) => {
    User.count(options, (err, c) => {
      if (err) throw err;
      else fullfill(c);
    });
  });
}

/** Categories */

/**
 * Get category by it's title;
 * Populates 'freelancers', returns only freelancers available for work and with full profile,
 * Sorts them by name for now.
 *
 * @param  {String} categoryTitle - Category title
 */
function getCategory(categoryTitle) {
  return new Promise((fullfill) => {
    Category.findOne({ title: categoryTitle })
      .populate({
        path: 'freelancers',
        match: {
          $and: [
            { busy: false },
            { bio: { $exists: true } },
            { hourly_rate: { $exists: true } },
          ],
        },
        options: {
          sort: {
            name: -1,
          },
        },
      })
      .exec((err, category) => {
        if (err) throw err;
        else fullfill(category);
      });
  });
}

/**
 * @todo fix it comment;
 *
 * Get all categories from db; populates 'freelancers', returns only freelancers available for work and with full profile, sorts them by name for now
 */
function getCategories() {
  return new Promise((fullfill) => {
    Category.find({})
      .sort('title')
      .populate({
        path: 'freelancers',
        match: {
          $and: [
            { busy: false },
            { bio: { $exists: true } },
            { hourly_rate: { $exists: true } },
          ],
        },
        options: {
          sort: {
            name: -1,
          },
        },
      })
      .exec((err, categories) => {
        if (err) throw err;
        else fullfill(categories);
      });
  });
}

/** Jobs */

/**
 * Getting job from db by it's id
 *
 * @param  {Mongo:ObjectId} id - Id of job to get
 * @param  {Object} populate - Can be String or usual JS object, this is passed to .populate()
 */
function findJobById(id, populate) {
  return new Promise((fullfill) => {
    Job.findById(id)
      .populate(((!populate) ? 'category' : `category  ${populate}`))
      .exec((err, job) => {
        if (err) throw err;
        else fullfill(job);
      });
  });
}

// TODO:Update doc
/**
 * Gets a list of available freelancers for job
 *
 * @param  {Mongo:Job} job - Job object for which freelancers are returned
 */
function freelancersForJob(job) {
  return new Promise((fullfill) => {
    User.find({ $and: [
      { categories: job.category },
      { busy: false },
      { ban_state: { $nin: true } },
      { bio: { $exists: true } },
      { hourly_rate: job.hourly_rate },
      { _id: { $nin: job.notInterestedCandidates } },
    ]})
      .sort({ sortRate: -1 })
      .limit(10) // TODO:Move to one place
      .skip(10 * job.current_page) // TODO:Move to one place
      .exec((err, users) => {
        if (err) throw err;
        else fullfill(users);
      });
  });
}

// TODO:Update doc
function freelancersForJobCount(job) {
  return new Promise((fullfill) => {
    User.count({ $and: [
      { categories: job.category },
      { busy: false },
      { ban_state: { $nin: true } },
      { bio: { $exists: true } },
      { hourly_rate: job.hourly_rate },
      { _id: { $nin: job.notInterestedCandidates } }
    ]})
      .exec((err, count) => {
        if (err) throw err;
        else fullfill(count);
      });
  });
}

// TODO:Update doc
function checkAndFixJobPage(job) {
  return new Promise((fullfill) => {
    freelancersForJobCount(job)
      .then((count) => {
        let pages = Math.ceil(count / 10) - 1; // TODO:Move to one place
        if (pages <= -1) pages = 0;

        if (job.current_page <= -1) job.current_page = 0;
        if (job.current_page > pages) job.current_page = pages;

        job.save()
          .then((job) => {
            fullfill({ job, count });
          });
      });
  });
}

/**
 * Gets a list of available freelancers for job
 *
 * @param  {Mongo:Object id} jobId - Job id object for which freelancers are returned
 */
function freelancersForJobId(jobId) {
  return new Promise((fullfill) => {
    findJobById(jobId)
      .then((job) => {
        freelancersForJob(job)
          .then(fullfill);
      });
  });
}

/**
 * Saves freelancer's message id and chat id to job in order to reuse later (i.e. edit job message)
 *
 * @param  {Telegram:Message} msg - Message came with inline
 * @param  {Mongoose:Job} job - Job to which we should add freelancer's inline
 * @param  {Mongoose:User} user - Freelancer whos inline should be added
 */
function saveFreelancerMessageToJob(msg, job, user) {
  return new Promise((fullfill) => {
    const chatInline = new UserChatInline({
      user,
      message_id: msg.message.message_id,
      chat_id: msg.message.chat.id,
    });

    chatInline.save()
      .then((chatInline) => {
        job.freelancer_chat_inlines.push(chatInline);
        job.save().then(fullfill);
      });
  });
}

/**
 * Returns number of active jobs
 */
function jobCount() {
  return new Promise((fullfill, reject) => {
    Job.count({
      state: strings.jobStates.searchingForFreelancer,
      description: {
        $exists: true,
      },
    }, (err, c) => {
      if (err) throw err;
      else fullfill(c);
    });
  });
}

// Review

/**
 * Get review by id
 *
 * @param  {Mongo:ObjectId} id - Id of review to retrieve
 * @param  {JS Object or String} populate - Option to populate fields in query result
 */
function findReviewById(id, populate) {
  return new Promise((fullfill) => {
    Review.findById(id)
      .populate(populate || '')
      .exec((err, review) => {
        if (err) throw err;
        else fullfill(review);
      });
  });
}

/**
 * Add review object
 *
 * @param {JS Object} review - Review template to add to db
 */
function addReview(review) {
  return new Promise((fullfill) => {
    const reviewObject = new Review(review);

    reviewObject.save()
      .then(fullfill);
  });
}

// Helpers

/**
 * Returns the right chat inline from job for freelancer
 *
 * @param {Mongoose:Job} job - Job where to search
 * @param {Mongoose:User} user - User for shom to search
 * @returns {Mongoose:UserChatInline} Chat inline object
 */
function chatInline(job, user) {
  let chatInline;

  job.freelancer_chat_inlines.forEach((ci) => {
    if (ci.chat_id === user.id) chatInline = ci;
  });

  return chatInline;
}

// Report

/**
 * Get report by id
 * @param  {Mongo:ObjectId} id -Id of review to retrieve
 * @param  {JS Object or String} populate - Option to populate fields in query result
 */
function findReportById(id, populate) {
  return new Promise((fullfill) => {
    Report.findById(id)
      .populate(populate || '')
      .exec((err, review) => {
        if (err) throw err;
        else fullfill(review);
      });
  });
}

// Export

module.exports = {
  // User
  getAllUsers,
  findUser,
  findUserById,
  addUser,
  toggleUserAvailability,
  toggleCategoryForUser,
  userCount,
  freelancerCount,
  // Categories
  getCategory,
  getCategories,
  // Jobs
  findJobById,
  freelancersForJob,
  freelancersForJobId,
  freelancersForJobCount,
  checkAndFixJobPage,
  saveFreelancerMessageToJob,
  jobCount,
  // Review
  findReviewById,
  addReview,
  // Helpers
  chatInline,
  // Reports
  findReportById,
};
