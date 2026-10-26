import { extractFields } from "@/lib/extraction/field-extractor";
const text = "CERTIFICATE OF REGISTRATION Name of Institution: Silverwood Institute of Technology Institution Registration No: REG-2024-88213 Application Reference Number: EXT-REF-0091 Academic Year: 2025-2026 Date of Issue: 12 March 2025 Valid upto: 11 March 2028 Certificate No: CERT-7742-SD";
console.log(JSON.stringify(extractFields(text), null, 1));
