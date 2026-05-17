import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized - Token missing or invalid format",
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        message: "Unauthorized - Token missing",
      });
    }

    const decode = jwt.decode(token);

    if (!decode || !decode.id) {
      return res.status(401).json({
        message: "Unauthorized - Invalid token payload",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decode.id, tokens: { has: token } },
      select: { id: true, email: true, role: true },
    });

    if (!user)
      return res.status(401).json({ message: "Session invalid or logged out" });

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

export const authorizeAdmin = async (req, res, next) => {
  try {
    if (req.user.role.toLowerCase() !== "admin")
      return res.status(400).json({ message: "Unauthorized" });
    next();
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
