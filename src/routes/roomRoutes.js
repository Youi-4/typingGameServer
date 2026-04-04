import express from "express";

import { toCreateRoomResponseDto } from "../dto/roomDto.js";
import { generateRoomId } from "../socket/roomStore.js";

export function createRoomRouter({ getOpenPublicRoomId }) {
  const router = express.Router();

  router.get("/create-room", (req, res) => {
    if (req.query.roomType === "private") {
      return res.status(200).json(toCreateRoomResponseDto(generateRoomId(), "private"));
    }

    if (req.query.roomType === "public") {
      return res.status(200).json(
        toCreateRoomResponseDto(getOpenPublicRoomId(), "public")
      );
    }

    return res.status(200).json(
      toCreateRoomResponseDto(String(req.query.roomType ?? generateRoomId()), "private")
    );
  });

  return router;
}
