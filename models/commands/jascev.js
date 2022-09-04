const Command = require("../Command.js");
const fs = require('fs');
const pkg = require('../../package.json');
const { inspect, promisify } = require("util");
const { exec } = require('child_process');
const got = require("got");

const sh = promisify(exec);

const types = {
    "js": 0,
    "javascript": 0,
    "src": 1,
    "source": 1,
    "haste": 2,
    "sh": 3,
    "shell": 3,
};

const wordTypes = {
    0: "JavaScript",
    1: "Source",
    2: "Haste",
    3: "Shell Command"
}

module.exports = class JascevCommand extends Command {
    constructor() {
        super("jascev", {
            name: 'jascev',
            aliases: ['jse'],
            owner: true
        })
    }

    exec(message) {
        this.#jse(message);
    }

    execute(message) {
        this.#jse(message);
    }

    async #jse(message) {
        let output;

        const Discord = this.Discord;

        const args = message.content.replace(/\?\?\?/, "").split(/ +/).slice(1);

        const noArgs = `${this.name} v${pkg.version}, ${Discord?.version ? `\`discord.js ${Discord?.version}\`, ` : ""}\`Node ${process.version}\` on \`${process.platform}\`\nModules were loaded <t:${Math.round(this.client.readyTimestamp / 1000)}:R>. Handlers were loaded <t:${Math.round(this.client.readyTimestamp / 1000)}:R>.\n\nThis bot is ${this.client.shard === null ? "not sharded" : `on shard ${this.client.shard}`} and can see ${(await this.client.guilds.fetch()).size} server(s) and ${(await this.client.users.cache.size)} user(s).\nMessage cache capped at {1000}, {presences intent is disabled}, {members intent is disabled}, and {message content intent is enabled}.\nAverage websocket latency: ${Math.round(this.client.ws.ping)}ms.`

        const type = args.shift().toLowerCase();

        const { flags, rest } = this.#flags(args.join(' '));

        if (types[type] === undefined) return await message.util ? await message.util.send(noArgs) : await message.channel.send(noArgs)

        if (types[type] == 0) output = await this.ev(message, rest);

        if (types[type] == 1) {
            let source, state;

            try {
                source = await eval(rest);

                if (typeof source === 'object') source = inspect(source);

                source = "```js\n" + source.toString() + "```";

                source = source.replace(this.client.token, "Ehm... This is awkward... No token...")

                state = true;
            }
            catch (e) {
                source = "Not a valid source."

                state = false;
            }

            output = { code: source, state: state, url: await this.haste(source) };
        };

        if (types[type] == 2) output = await this.#haste(rest);

        if (types[type] == 3) output = await this.shell(rest);

        let embed = new Discord.EmbedBuilder()
            .setTitle(wordTypes[types[type]])
            .setDescription(output.code?.length < 4000 ? output.code : `Code is ${output.code?.length} characters. Can't show within discord.`)
            .setColor(output.state ? "#004200" : "#420000")
            .setURL(output.url)
            .setFooter({ text: message.author.username, iconURL: message.author.avatarURL({ dynamic: true }) })
            .setTimestamp()

        if (!flags.nomsg) await message.util.reply({ content: null, embeds: [embed] });

        if (flags.dm) await message.author.send({ content: null, embeds: [embed] });

        if (flags.nosrc) await message.delete();
    }

    clean(text) {
        if (typeof text === 'string') return text.replace(/`/g, '`' + String.fromCharCode(8203)).replace(/@/g, '@' + String.fromCharCode(8203));
        else return text;
    }

    async ev(message, code) {
        if (!code) code = '"No code value was given.";'

        const channel = await message.channel,
            author = await message.author,
            guild = await message.guild,
            member = await message.member,
            members = await message?.guild?.members,
            users = await this.client.users,
            guilds = (await this.client.guilds.fetch()).values(),
            client = await this.client;

        let output, state;

        code = code?.replace(/```js\n|```/g, "");

        try {
            output = await eval(`(async () => { ${code} })();`);

            state = true;
        }
        catch (error) {
            output = error.name + ": " + error.message;

            state = false;
        }

        if (typeof output !== 'string') output = inspect(output)

        output = output.replaceAll(this.client.token, "You thought you'd be able to get my token didn't you!");

        output = await this.clean(output)

        return { code: "```js\n" + output + "```", state, url: await this.haste(inspect(output)) };
    }

    async #haste(code) {
        let output = {}, dir, body;

        try {
            dir = fs.readdirSync(code);
        }
        catch {
            dir = undefined;
        }

        if (!code) output = { code: `You're currently in: \`${fs.realpathSync("./")}\`\nThe following files and folders are stored here\n>>> ${fs.readdirSync("./").join('\n')}`, state: true, url: await this.haste(body) };

        else if (Array.isArray(dir)) output = { code: `You're currently in: \`${fs.realpathSync("./" + code)}\`\nThe following files and folders are stored here\n>>> ${fs.readdirSync("./" + code).join('\n')}`, state: true, url: await this.haste(body) };

        else if (!Array.isArray(dir)) {
            try {
                body = fs.readFileSync(code, { encoding: 'utf-8' });

                output = { code: `\`\`\`${code.match(/\.\w+/g)[0].replace(/\./g, "")}\n` + body + "```", state: true, url: await this.haste(body) };
            }
            catch (error) {
                output = { code: "Not a valid path", state: false, url: await this.haste(inspect(error)) };
            }
        }

        return output;
    }

    async shell(code) {
        let output = {};

        try {
            let shell = await sh(code)

            output.code = "```js\n" + inspect(shell) + "```";

            output.state = true;

            output.url = await this.haste(inspect(shell));
        }
        catch (error) {
            output.code = error.name + ": " + error.message;

            output.state = false;

            output.url = await this.haste(inspect(error));
        }

        return output;
    }

    async haste(text) {
        const hasteURLs = [
            "https://hst.sh",
            "https://hastebin.com",
            "https://haste.clicksminuteper.net",
            "https://haste.tyman.tech"
        ];

        for (const url of hasteURLs) {
            try {
                const resp = await got.post(url + "/documents", {
                    body: text
                }).json()
                return `${url}/${resp.key}`;
            } catch (e) {
                console.error(e);
                continue;
            }
        }
        throw new Error("Haste failure");
    }

    #flags(content) {
        let flags = [{ name: "nomsg", match: "--nomsg" }, { name: "nosrc", match: "--nosrc" }, { name: "dm", match: "--dm" }], flgs = {};

        flags.map(flag => {
            for (const flg of content.matchAll(flag.match)) {
                if (flag.match == flg) {
                    content = content.replace(flag.match, "");

                    flgs[flag.name] = true;
                }
            }

            if (!flags[flag]) flags[flag] = false;
        })

        return { flags: flgs, rest: content };
    }
}