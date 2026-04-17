declare module "pa11y" {
  interface Pa11yOptions {
    standard?: "WCAG2A" | "WCAG2AA" | "WCAG2AAA";
    timeout?: number;
    wait?: number;
    ignore?: string[];
    runners?: string[];
  }

  interface Pa11yIssue {
    code: string;
    type: "error" | "warning" | "notice";
    typeCode: number;
    message: string;
    context: string;
    selector: string;
    runner: string;
  }

  interface Pa11yResults {
    documentTitle: string;
    pageUrl: string;
    issues: Pa11yIssue[];
  }

  function pa11y(url: string, options?: Pa11yOptions): Promise<Pa11yResults>;
  export default pa11y;
}
