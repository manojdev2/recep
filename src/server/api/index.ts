import "server-only";
import { account, billing } from "./account";
import { admin } from "./admin";
import { agents } from "./agents";
import { calling } from "./calling";
import { chat } from "./chat";
import { connectors } from "./connectors";
import { contacts } from "./contacts";
import { demo, demoVoice } from "./demo";
import { design } from "./design";
import { hours } from "./hours";
import { knowledge } from "./knowledge";
import { outcomes } from "./outcomes";
import { setup } from "./setup";
import { site } from "./site";
import { tools } from "./tools";

/** Every function the browser can call, grouped by area: `api.<group>.<name>(input)`. */
export const registry = {
  account,
  admin,
  agents,
  billing,
  calling,
  chat,
  connectors,
  contacts,
  demo,
  demoVoice,
  design,
  hours,
  knowledge,
  outcomes,
  setup,
  site,
  tools,
};

export type Api = typeof registry;
