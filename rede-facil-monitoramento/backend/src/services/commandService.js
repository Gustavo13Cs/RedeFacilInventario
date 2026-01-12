const commandQueue = {};

exports.addCommand = (uuid, command) => {
    commandQueue[uuid] = command;
};

exports.getCommand = (uuid) => {
    const cmd = commandQueue[uuid];
    if (cmd) {
        delete commandQueue[uuid]; 
        return cmd;
    }
    return null;
};