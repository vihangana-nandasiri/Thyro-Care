import { expect,test } from "bun:test";
import { publicUrl,resourceInput } from "./types";
test("external resource links reject script and local URLs",()=>{for(const url of ["javascript:alert(1)","http://example.com","https://localhost/x","https://127.0.0.1/x","https://10.0.0.1/","https://user:password@example.com"]){expect(publicUrl(url)).toBe(false);}expect(publicUrl("https://www.thyroid.org/patient-thyroid-information/")).toBe(true);});
test("client-supplied approval is stripped when saving a discovered resource",()=>{const parsed=resourceInput.parse({title:"Thyroid care",url:"https://www.thyroid.org/",kind:"article",language:"ta",status:"approved",approvedBy:"attacker"});expect(parsed).not.toHaveProperty("status");expect(parsed).not.toHaveProperty("approvedBy");});
