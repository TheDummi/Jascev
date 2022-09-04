const fs = require('fs');

function toCommands(client) {
    if (client.commands) {
        if (client.commands.message) return client.commands.message;
    }

    else if (client.messageCommands) return client.messageCommands;

    else return;
}

module.exports = new class Load {
    constructor() {

    }

    load(client, options = {}) {
        if (!client) return;

        const commands = toCommands(client);

        if (commands) {
            const files = fs.readdirSync(`${__dirname}/commands`);

            for (const file of files) {
                const command = new (require(`${__dirname}/commands/${file}`));

                command.client = client;

                command.filepath = `${__dirname}/commands/${file}`;

                for (const definition of options.definitions) {
                    const [[key, val]] = Object.entries(definition);

                    command[key] = val
                }

                commands.set(command.id, command);
            }
        }
    }
}