const ws = require("ws");

const argv = process.argv.slice(2);
const relays = new Set();
const pending = new Map();

if (!argv.length) return console.log("Usage: node rtr.js wss://relay1.example.com wss://relay2.example.com ....");

relays.broadcast = (ws, data) => {
  relays.forEach(r => {
    if (ws === r) return;
    if (r.readyState !== 1) return pending.get(r.addr).push(data);
    r.send(data);
  });
}

function newrelay(addr, eose = false) {
  const relay = new ws(addr);

  relay.addr = addr;
  pending.set(addr, []);

  relay.on('open', _ => {
    relay.send('["REQ", "relayevent", {}]');
    pending.get(addr).forEach(d => {
      relay.send(JSON.stringify(["EVENT", d]));
      pending.get(addr).shift();
    });
  });

  relay.on('message', data => {
    try {
      data = JSON.parse(data);
    } catch (error) {
      return console.error(error);
    }

    console.log(eose, relay.addr, JSON.stringify(data));

    if (data[0] === "EOSE" && !eose) eose = true;

    if (!process.env.NO_WAIT_EOSE && !eose) return;
    if (data[0] !== "EVENT") return;
    relays.broadcast(relay, JSON.stringify(["EVENT", data[2]]));
    console.log("------------- transmitted")
  });

  relay.on('error', console.error);
  relay.on('close', _ => {
    for (i in ['open', 'message', 'error', 'close']) {
      relay.removeAllListeners(i);
    }

    relays.delete(relay);
    newrelay(addr);
  });

  relays.add(relay);
}

argv.forEach(_ => newrelay(_));
