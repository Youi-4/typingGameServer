import { toAuthStatusResponseDto } from "../dto/authDto.js";
import { getUserByAccountID } from "../models/userModel.js";

export function createAuthValidateController({
  getUserByAccountId = getUserByAccountID,
}) {
  return async function authValidate(req, res) {
    const user = await getUserByAccountId(req.accountID);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(toAuthStatusResponseDto(user));
  };
}

export const authValidate = createAuthValidateController({});
