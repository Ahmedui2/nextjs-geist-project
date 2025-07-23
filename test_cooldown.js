const assert = require("assert");
const { execute } = require("./commands/cooldown.js");
const responsibilities = require("./responsibilities.json");

const message = {
    member: {
        permissions: {
            has: () => true
        }
    },
    channel: {
        send: (options) => {
            console.log("Message sent:", JSON.stringify(options, null, 2));
            assert(options.embeds[0].title === "Cooldown Settings");
            assert(options.components[0].components[0].custom_id === "cooldown_res_select");
        }
    }
};

execute(message, [], { responsibilities });
