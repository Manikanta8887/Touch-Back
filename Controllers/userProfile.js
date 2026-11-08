import User from "../Models/user.js";

export const getUserProfile = async (req, res) => {
  try {
    let user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      user = {
        uid: req.params.uid,
        name: "Streamer",
        email: "",
        bio: "",
        profilePic: "",
        subscribersCount: 0,
        subscribers: [],
        videos: [],
        subscribedTo: [],
        storageUsed: 0,
        storageLimit: 1073741824, // 1 GB
      };
    } else {
      // Calculate real storage used from user's actual uploaded videos
      const realStorage = Array.isArray(user.videos)
        ? user.videos.reduce((sum, v) => sum + (v.sizeInBytes || 0), 0)
        : 0;
      if (user.storageUsed !== realStorage) {
        user.storageUsed = realStorage;
        await user.save().catch(() => {});
      }
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
      if (subscriberUid) {
        await User.updateOne({ uid: subscriberUid }, { $pull: { subscribedTo: uid } });
      }
    } else {
      if (subscriberUid) {
        user.subscribers.push(subscriberUid);
        await User.updateOne({ uid: subscriberUid }, { $addToSet: { subscribedTo: uid } });
      }
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

export const getSubscribedChannels = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user || !user.subscribedTo || user.subscribedTo.length === 0) {
      return res.json({
        success: true,
        channels: [],
      });
    }

    const channels = await User.find(
      { uid: { $in: user.subscribedTo } },
      "uid name email profilePic bio subscribersCount subscribers videos"
    );

    return res.json({
      success: true,
      channels,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving subscriptions",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export default getUserProfile;
