import {createBroker} from "../index";

export const meId = Math.random().toString(36).substring(7);
console.log(`[${meId}] Starting...`);

const broker = createBroker((message) => {
    console.log(`[${meId}] Received: ${message}`);
});

setInterval(() => {
    broker.send(`[${meId}] ${new Date().toISOString()}`);
}, 1000);
