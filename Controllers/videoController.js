import User from "../Models/user.js";
import cloudinary from "../utils/Cloudinary.js";
import { verifyOwnership } from "../middleware/auth.js";

// PERF-005: Shared helper to fetch Cloudinary videos and merge with MongoDB records
const generateThumbnail = (videoUrl) => {
  // BUG-017: Generate a real image thumbnail via Cloudinary URL transformation
  // Replace video extension with jpg and inject transformation params
  return videoUrl
    .replace(/\.(mp4|webm|mov)(\?.*)?$/, ".jpg")
    .replace("/upload/", "/upload/w_400,h_300,c_fill,so_2/");
};

const fetchCloudinaryVideos = async (prefix = null) => {
  const params = {
    resource_type: "video",
    max_results: 100,
    type: "upload",
  };
  // E-6: Filter by user-specific folder prefix if provided
  if (prefix) params.prefix = prefix;

  const cloudinaryResult = await cloudinary.api.resources(params);
  if (!cloudinaryResult || !cloudinaryResult.resources) return [];

  return cloudinaryResult.resources.map((resItem) => ({
    url: resItem.secure_url || resItem.url,
    public_id: resItem.public_id,
    coverImage: generateThumbnail(resItem.secure_url || resItem.url),
    sizeInBytes: resItem.bytes || 0,
    title: resItem.public_id.split("/").pop().replace(/_/g, " "),
    createdAt: resItem.created_at,
  }));
};

const mergeVideos = (cloudinaryVideos, mongoVideos, extraFields = {}) => {
  const combinedMap = new Map();
  cloudinaryVideos.forEach((v) => combinedMap.set(v.public_id, { ...v, ...extraFields }));
  mongoVideos.forEach((v) => {
    const vObj = v.toObject ? v.toObject() : v;
    combinedMap.set(vObj.public_id, { ...combinedMap.get(vObj.public_id), ...vObj });
  });
  return Array.from(combinedMap.values());
};

export const uploadVideo = async (req, res) => {
  const { uid } = req.params;
  const { title } = req.body;

  if (!verifyOwnership(req, uid)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: You can only upload videos to your own profile",
    });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No video file uploaded" });
  }

  try {
    let user = await User.findOne({ uid });
    if (!user) {
      user = new User({
        uid,
        name: req.user?.displayName || req.user?.email?.split("@")[0] || "Streamer",
        email: req.user?.email || `${uid}@guest.touchlive.com`,
        videos: [],
      });
    }

    const { path: url, filename: public_id, size } = req.file;
    // BUG-017: Generate a proper thumbnail instead of using the video url
    const coverImage = generateThumbnail(url);

    const newVideo = {
      url,
      public_id,
      coverImage,
      sizeInBytes: size,
      title: title || "Untitled Video",
    };

    user.videos.push(newVideo);
    await user.save();

    const createdVideo = user.videos[user.videos.length - 1];

    return res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: { video: createdVideo },
    });
  } catch (err) {
    console.error("Upload video error:", err);
    return res.status(500).json({
      success: false,
      message: "Upload failed",
      ...(process.env.NODE_ENV !== "production" && { error: err.message }),
    });
  }
};

export const getUserVideos = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });

    const mongoVideos = user ? (user.videos || []) : [];
    let cloudinaryVideos = [];

    try {
      // E-6: Use user-specific prefix to filter only this user's Cloudinary videos
      cloudinaryVideos = await fetchCloudinaryVideos(`touch_live_videos/${uid}/`);
    } catch (cErr) {
      console.warn("Cloudinary user videos fetch warning:", cErr.message);
    }

    const finalVideos = mergeVideos(cloudinaryVideos, mongoVideos);

    return res.json({
      success: true,
      message: "Fetched user videos successfully",
      data: { videos: finalVideos },
    });
  } catch (err) {
    console.error("getUserVideos error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching user videos",
      ...(process.env.NODE_ENV !== "production" && { error: err.message }),
    });
  }
};

export const getAllVideos = async (req, res) => {
  try {
    const page = req.query?.page ? Math.max(1, parseInt(req.query.page, 10)) : null;
    const limit = req.query?.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10))) : 20;

    const users = await User.find({}, "name uid videos");
    const mongoVideos = users.flatMap((u) =>
      (u.videos || []).map((v) => ({
        ...(v.toObject ? v.toObject() : v),
        uploaderName: u.name || "Streamer",
        uploaderUid: u.uid,
      }))
    );

    let cloudinaryVideos = [];
    try {
      // PERF-005: Use shared helper; no user prefix = all videos
      cloudinaryVideos = await fetchCloudinaryVideos();
    } catch (cErr) {
      console.warn("Cloudinary all videos fetch warning:", cErr.message);
    }

    const finalVideos = mergeVideos(cloudinaryVideos, mongoVideos, { uploaderName: "Touch Live Streamer" });
    const paginated = page ? finalVideos.slice((page - 1) * limit, page * limit) : finalVideos;

    return res.json({
      success: true,
      message: "Fetched all videos successfully",
      data: {
        videos: paginated,
        total: finalVideos.length,
        ...(page && { page, limit, totalPages: Math.ceil(finalVideos.length / limit) }),
      },
    });
  } catch (err) {
    console.error("getAllVideos error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching all videos",
      ...(process.env.NODE_ENV !== "production" && { error: err.message }),
    });
  }
};

export const deleteVideo = async (req, res) => {
  // BUG-007/P2-3: Accept public_id as a query param to handle slashes in Cloudinary folder paths
  const public_id = req.query.public_id;

  if (!public_id) {
    return res.status(400).json({ success: false, message: "public_id query parameter is required" });
  }

  try {
    const ownerUser = await User.findOne({ "videos.public_id": public_id });

    if (ownerUser && !verifyOwnership(req, ownerUser.uid)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot delete another user's video",
      });
    }

    // Destroy on Cloudinary
    try {
      await cloudinary.uploader.destroy(public_id, { resource_type: "video" });
    } catch (cErr) {
      console.warn("Cloudinary destroy error:", cErr.message);
    }

    if (ownerUser) {
      ownerUser.videos = ownerUser.videos.filter((v) => v.public_id !== public_id);
      await ownerUser.save();
    }

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (err) {
    console.error("Delete video error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete video",
      ...(process.env.NODE_ENV !== "production" && { error: err.message }),
    });
  }
};