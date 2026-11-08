import mongoose from "mongoose";

const StreamSchema = new mongoose.Schema(
  {
    streamerId: { type: String, required: true },
    streamTitle: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number, default: 0 },
    viewers: { type: Number, default: 0 },
    isFullscreen: { type: Boolean, default: false },
    chatMessages: [
      {
        sender: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Stream = mongoose.models.Stream || mongoose.model("Stream", StreamSchema);
export default Stream;
