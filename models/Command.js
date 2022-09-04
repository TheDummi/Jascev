module.exports = class Command {
    constructor(id, options) {
        this.id = id

        Object.entries(options)
            .map(([key, value]) => {
                this[key] = value;
            })
    }

    exec() {

    }
}