// Registers the agent team and sets up the #curio-mind room. Safe to run again.
import { randomUUID } from 'node:crypto';
import { registerAgent, SwitchAgent } from '@curio/switch-client';
import {
  readTeamStore,
  ROOM_DESCRIPTION,
  ROOM_INSTRUCTIONS,
  ROOM_NAME,
  TEAM,
  writeTeamStore,
} from '../apps/server/src/team';

const apiUrl = process.env.SWITCH_API_URL;
const registrationKey = process.env.SWITCH_REGISTRATION_KEY;
const ownerName = process.env.OWNER_NAME ?? 'user';

if (!apiUrl || !registrationKey) {
  console.error('.env needs SWITCH_API_URL and SWITCH_REGISTRATION_KEY. Run pnpm switch:key.');
  process.exit(1);
}

const store = readTeamStore();

for (const agent of TEAM) {
  if (store.agents[agent.name]) continue;
  const credentials = await registerAgent(apiUrl, registrationKey, agent);
  store.agents[agent.name] = { ...credentials, connectionId: randomUUID() };
  writeTeamStore(store);
  console.log(`Registered ${agent.name}`);
}

const first = TEAM[0]!;
const credentials = store.agents[first.name]!;
const admin = new SwitchAgent({
  apiUrl,
  name: first.name,
  id: credentials.id,
  apiKey: credentials.apiKey,
  connectionId: randomUUID(),
});
await admin.start();

const names = TEAM.map((agent) => agent.name);

if (store.roomId) {
  const room = await admin.op<{ agent_names: string[] }>('get_room_detail', {
    room_id: store.roomId,
  });
  const present = new Set(room.agent_names);
  for (const name of names) {
    if (present.has(name)) continue;
    await admin.op('invite_agent_to_room', { room_id: store.roomId, agent_name: name });
    console.log(`Invited ${name}`);
  }
  await admin.op('update_room', { room_id: store.roomId, instructions: ROOM_INSTRUCTIONS });
} else {
  const room = await admin.op<{ id: string }>('create_room', {
    name: ROOM_NAME,
    description: ROOM_DESCRIPTION,
    agent_names: names,
    user_names: [ownerName],
    channel_type: 'channel_public',
    instructions: ROOM_INSTRUCTIONS,
  });
  store.roomId = room.id;
  writeTeamStore(store);
  console.log(`Created #${ROOM_NAME}`);
}

admin.stop();
console.log('Team ready.');
process.exit(0);
