module.exports = {
  ...require('./discussion/roomController'),
  ...require('./discussion/messageController'),
  ...require('./discussion/documentController'),
  ...require('./discussion/taskController'),
  ...require('./discussion/matchController'),
  ...require('./discussion/friendController')
};
