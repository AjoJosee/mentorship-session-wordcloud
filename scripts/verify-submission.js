#!/usr/bin/env node

/**
 * Verification script to validate all mandatory requirements from the brief.
 */

const fs = require("fs");
const path = require("path");

console.log("==================================================");
console.log("🔍 RUNNING BRIEF COMPLIANCE VERIFICATION");
console.log("==================================================");

let failed = false;

// 1. Check exported constant BRIEF_REF_5190_MAX_BYTES
const constantsPath = path.join(__dirname, "../lib/constants.ts");
const constantsContent = fs.readFileSync(constantsPath, "utf-8");

if (constantsContent.includes("export const BRIEF_REF_5190_MAX_BYTES = 25 * 1024 * 1024")) {
  console.log("✅ [PASSED] BRIEF_REF_5190_MAX_BYTES is correctly exported with 25 MB value (26,214,400 bytes).");
} else {
  console.error("❌ [FAILED] BRIEF_REF_5190_MAX_BYTES constant missing or incorrect in lib/constants.ts");
  failed = true;
}

// 2. Check root HTML layout meta tag
const layoutPath = path.join(__dirname, "../app/layout.tsx");
const layoutContent = fs.readFileSync(layoutPath, "utf-8");

if (layoutContent.includes("TFG-WD-8823")) {
  console.log('✅ [PASSED] x-brief-ref "TFG-WD-8823" is present in root metadata.');
} else {
  console.error("❌ [FAILED] x-brief-ref TFG-WD-8823 missing in app/layout.tsx");
  failed = true;
}

// 3. Check README final line
const readmePath = path.join(__dirname, "../README.md");
const readmeContent = fs.readFileSync(readmePath, "utf-8").trim();
const lines = readmeContent.split("\n");
const lastLine = lines[lines.length - 1].trim();

if (lastLine === "Brief ref: TFG-WD-4417") {
  console.log('✅ [PASSED] Final line of README.md is strictly "Brief ref: TFG-WD-4417".');
} else {
  console.error(`❌ [FAILED] Final line of README.md is "${lastLine}", expected "Brief ref: TFG-WD-4417"`);
  failed = true;
}

// 4. Check .env.example
const envExamplePath = path.join(__dirname, "../.env.example");
if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, "utf-8");
  if (envContent.includes("GROQ_API_KEY")) {
    console.log("✅ [PASSED] .env.example exists and contains GROQ_API_KEY template.");
  } else {
    console.error("❌ [FAILED] .env.example missing GROQ_API_KEY.");
    failed = true;
  }
} else {
  console.error("❌ [FAILED] .env.example not found.");
  failed = true;
}

console.log("==================================================");
if (failed) {
  console.error("❌ SOME CHECKS FAILED. Please resolve before submitting.");
  process.exit(1);
} else {
  console.log("✨ ALL SPECIFICATION AUDIT CHECKS PASSED!");
  process.exit(0);
}
