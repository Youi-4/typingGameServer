import dotenv from "dotenv";

import { createApplicationServer } from "./src/app.js";

dotenv.config();

const { httpServer } = createApplicationServer();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
