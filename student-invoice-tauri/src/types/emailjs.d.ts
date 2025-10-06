declare module '@emailjs/browser' {
  interface EmailJSResponse {
    status: number;
    text: string;
  }

  interface EmailJSParams {
    service_id: string;
    template_id: string;
    template_params?: Record<string, any>;
    user_id: string;
  }

  function send(
    service_id: string,
    template_id: string,
    template_params: Record<string, any>,
    user_id: string
  ): Promise<EmailJSResponse>;

  const emailjs: {
    send: typeof send;
  };

  export default emailjs;
}
