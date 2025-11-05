// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { name } from "./file2.ts";
import { randomInt } from "./file3.ts";
console.info('server started');
Deno.serve(async (req)=>{
  const data = {
    message: `This shit is crazy ${name} ${randomInt()}`
  };
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
});
