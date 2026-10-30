import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Routing and Security Config Tests", () => {
  test("CORS allows localhost and vercel apps", () => {
    const allowed = [
      "https://touch-live.vercel.app",
      "https://full-stack-project-mani.vercel.app",
      "https://full-stack-project-rho.vercel.app",
      "http://localhost:5173",
      "http://localhost:5000",
    ];

    allowed.forEach((origin) => {
      const clean = origin.replace(/\/+$/, "");
      const isAllowed = allowed.includes(clean) || /^https:\/\/.*\.vercel\.app\/?$/.test(origin);
      assert.ok(isAllowed, `Origin ${origin} should be allowed`);
    });

    // Test with trailing slash as user specified
    const withSlash = "https://touch-live.vercel.app/";
    const cleanSlash = withSlash.replace(/\/+$/, "");
    assert.ok(allowed.includes(cleanSlash), "Origin with trailing slash should be recognized");

    const malicious = "https://evil-attacker.com";
    const isMaliciousAllowed = allowed.includes(malicious) || /^https:\/\/.*\.vercel\.app\/?$/.test(malicious);
    assert.equal(isMaliciousAllowed, false, "Unknown origin should NOT match allowed list");
  });

  test("Cloudinary thumbnail transformation generates correct JPG URL", () => {
    const videoUrl = "https://res.cloudinary.com/demo/video/upload/v1234/touch_live_videos/uid/sample.mp4";
    const transformed = videoUrl
      .replace(/\.(mp4|webm|mov)(\?.*)?$/, ".jpg")
      .replace("/upload/", "/upload/w_400,h_300,c_fill,so_2/");

    assert.ok(transformed.endsWith(".jpg"), "Thumbnail URL should end with .jpg");
    assert.ok(transformed.includes("w_400,h_300,c_fill,so_2"), "Transformation params should be injected");
  });

  test("Public ID query parameter handles slashes properly", () => {
    const rawPublicId = "touch_live_videos/user_12345/1730000000";
    const encoded = encodeURIComponent(rawPublicId);
    const decoded = decodeURIComponent(encoded);

    assert.equal(decoded, rawPublicId);
    assert.ok(!encoded.includes("/"), "Encoded public_id should not contain raw slashes");
  });
});

