import User from "../Models/user.js";

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.json({
      success: true,
      message: "User profile retrieved successfully",
      data: { user },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error retrieving profile",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export const toggleSubscribe = async (req, res) => {
  try {
    const { uid } = req.params;
    const { subscriberUid } = req.body;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.subscribers) user.subscribers = [];
    const idx = subscriberUid ? user.subscribers.indexOf(subscriberUid) : -1;
    let subscribed = false;

    if (idx > -1) {
      user.subscribers.splice(idx, 1);
      subscribed = false;
    } else {
      if (subscriberUid) user.subscribers.push(subscriberUid);
      subscribed = true;
    }

    user.subscribersCount = user.subscribers.length;
    await user.save();

    return res.json({
      success: true,
      subscribed,
      subscribersCount: user.subscribersCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error toggling subscription",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export default getUserProfile;
