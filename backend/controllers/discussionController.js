module.exports = {
  ...require('./discussion/roomController'),
  ...require('./discussion/messageController'),
  ...require('./discussion/settingsController'),
  ...require('./discussion/memoryController'),
  ...require('./discussion/documentController'),
  ...require('./discussion/taskController'),
  ...require('./discussion/groupRoomController'),
  ...require('./discussion/matchController'),
  ...require('./discussion/friendController')
};
