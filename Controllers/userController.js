import User from "../Models/user.js";

export const saveUser = async (req, res) => {
  try {
    const { uid, name, email, profilePic } = req.body;

    // Auth validation check if req.user is populated
    if (req.user && req.user.uid !== uid) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cannot register or update another user's UID",
      });
    }

    // P2-5/BUG-009: Use upsert to always keep name and profilePic fresh on login
    const user = await User.findOneAndUpdate(
      { uid },
      { $set: { name, profilePic }, $setOnInsert: { email } },
      { upsert: true, new: true, runValidators: false }
    );

    const isNew = user.createdAt && (Date.now() - user.createdAt.getTime() < 5000);
    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? "User stored successfully" : "User profile synced",
      data: { user },
    });
  } catch (error) {
    console.error("Error Saving User:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error: Unable to save user",
      // SEC-007: never expose internal error.message in production
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    // P2-1/SEC-003: Exclude email to prevent PII exposure; add basic pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const users = await User.find({}, "uid name profilePic bio")
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: { users, page, limit },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching users",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};
