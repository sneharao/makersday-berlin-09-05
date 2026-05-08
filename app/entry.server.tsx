/* eslint-disable max-params */
import { PassThrough } from "node:stream";

import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";

export const streamTimeout = 15000;
const ABORT_DELAY = 16_000;

export default function handle_request(
  request: Request,
  response_status_code: number,
  response_headers: Headers,
  router_context: EntryContext,
  _load_context: AppLoadContext,
): Promise<Response> {
  const prohibit_out_of_order_streaming = is_bot_request(request.headers.get("user-agent")) || router_context.isSpaMode;
  return prohibit_out_of_order_streaming
    ? handle_bot_request(request, response_status_code, response_headers, router_context)
    : handle_browser_request(request, response_status_code, response_headers, router_context);
}

function is_bot_request(user_agent: string | null): boolean {
  if (!user_agent) return false;
  return isbot(user_agent);
}

function handle_bot_request(
  request: Request,
  response_status_code: number,
  response_headers: Headers,
  router_context: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shell_rendered = false;
    let status_code = response_status_code;
    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={router_context} url={request.url} />, {
      onAllReady() {
        shell_rendered = true;
        const body = new PassThrough();
        const stream = createReadableStreamFromReadable(body);
        response_headers.set("Content-Type", "text/html");
        resolve(new Response(stream, { headers: response_headers, status: status_code }));
        pipe(body);
      },
      onShellError(error: unknown) {
        reject(error);
      },
      onError(error: unknown) {
        status_code = 500;
        if (shell_rendered) {
          console.error(error);
        }
      },
    });
    setTimeout(abort, ABORT_DELAY);
  });
}

function handle_browser_request(
  request: Request,
  response_status_code: number,
  response_headers: Headers,
  router_context: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shell_rendered = false;
    let status_code = response_status_code;
    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={router_context} url={request.url} />, {
      onShellReady() {
        shell_rendered = true;
        const body = new PassThrough();
        const stream = createReadableStreamFromReadable(body);
        response_headers.set("Content-Type", "text/html");
        resolve(new Response(stream, { headers: response_headers, status: status_code }));
        pipe(body);
      },
      onShellError(error: unknown) {
        reject(error);
      },
      onError(error: unknown) {
        status_code = 500;
        if (shell_rendered) {
          console.error(error);
        }
      },
    });
    setTimeout(abort, ABORT_DELAY);
  });
}
