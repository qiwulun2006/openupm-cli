/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const assert = require("assert");
const nock = require("nock");
const should = require("should");
const { parseEnv, loadManifest } = require("../lib/core");
const deps = require("../lib/cmd-deps");
const {
  getWorkDir,
  createWorkDir,
  removeWorkDir,
  captureStream,
  nockUp,
  nockDown
} = require("./utils");

describe("cmd-deps.js", function() {
  const options = {
    parent: {
      registry: "http://example.com",
      chdir: getWorkDir("test-openupm-cli")
    }
  };
  describe("deps", function() {
    let stdout;
    let stderr;
    const remotePkgInfoA = {
      name: "com.example.package-a",
      versions: {
        "1.0.0": {
          name: "com.example.package-a",
          version: "1.0.0",
          dependencies: {
            "com.example.package-b": "1.0.0"
          }
        }
      },
      "dist-tags": {
        latest: "1.0.0"
      }
    };
    const remotePkgInfoB = {
      name: "com.example.package-b",
      versions: {
        "1.0.0": {
          name: "com.example.package-b",
          version: "1.0.0",
          dependencies: {
            "com.example.package-up": "1.0.0"
          }
        }
      },
      "dist-tags": {
        latest: "1.0.0"
      }
    };
    const remotePkgInfoUp = {
      name: "com.example.package-up",
      versions: {
        "1.0.0": {
          name: "com.example.package-up",
          version: "1.0.0",
          dependencies: {}
        }
      },
      "dist-tags": {
        latest: "1.0.0"
      }
    };
    beforeEach(function() {
      removeWorkDir("test-openupm-cli");
      createWorkDir("test-openupm-cli", { manifest: true });
      nockUp();
      nock("http://example.com")
        .get("/com.example.package-a")
        .reply(200, remotePkgInfoA, { "Content-Type": "application/json" });
      nock("http://example.com")
        .get("/com.example.package-b")
        .reply(200, remotePkgInfoB, { "Content-Type": "application/json" });
      nock("http://example.com")
        .get("/pkg-not-exist")
        .reply(404);
      nock("http://example.com")
        .get("/com.example.package-up")
        .reply(404);
      nock("https://api.bintray.com")
        .get("/npm/unity/unity/com.example.package-up")
        .reply(200, remotePkgInfoUp, {
          "Content-Type": "application/json"
        });
      nock("https://api.bintray.com")
        .get("/npm/unity/unity/pkg-not-exist")
        .reply(404);
      stdout = captureStream(process.stdout);
      stderr = captureStream(process.stderr);
    });
    afterEach(function() {
      removeWorkDir("test-openupm-cli");
      nockDown();
      stdout.unhook();
      stderr.unhook();
    });
    it("deps pkg", async function() {
      const retCode = await deps("com.example.package-a", options);
      retCode.should.equal(0);
      const stdoutContent = stdout.captured();
      stdoutContent.includes("com.example.package-b").should.be.ok();
    });
    it("deps pkg --deep", async function() {
      const retCode = await deps("com.example.package-a", {
        ...options,
        deep: true
      });
      retCode.should.equal(0);
      const stdoutContent = stdout.captured();
      stdoutContent.includes("com.example.package-b").should.be.ok();
      stdoutContent.includes("com.example.package-up").should.be.ok();
    });
    it("deps pkg@latest", async function() {
      const retCode = await deps("com.example.package-a@latest", options);
      retCode.should.equal(0);
      const stdoutContent = stdout.captured();
      stdoutContent.includes("com.example.package-b").should.be.ok();
    });
    it("deps pkg@1.0.0", async function() {
      const retCode = await deps("com.example.package-a@1.0.0", options);
      retCode.should.equal(0);
      const stdoutContent = stdout.captured();
      stdoutContent.includes("com.example.package-b").should.be.ok();
    });
    it("deps pkg@not-exist-version", async function() {
      const retCode = await deps("com.example.package-a@2.0.0", options);
      retCode.should.equal(0);
      stderr
        .captured()
        .includes("is not a valid choice")
        .should.be.ok();
      console.log(stdout.captured());
    });
    it("deps pkg-not-exist", async function() {
      const retCode = await deps("pkg-not-exist", options);
      retCode.should.equal(0);
      stderr
        .captured()
        .includes("package not found")
        .should.be.ok();
    });
    it("deps pkg upstream", async function() {
      const retCode = await deps("com.example.package-up", options);
      retCode.should.equal(0);
    });
  });
});
