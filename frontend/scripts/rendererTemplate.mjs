export function createDynamicAdRendererTemplate(template) {
  if (
    typeof template !== "string" ||
    !/<html(?:\s|>)/i.test(template) ||
    !/<head(?:\s|>)[\s\S]*<\/head>/i.test(template) ||
    !/<body(?:\s|>)[\s\S]*<\/body>/i.test(template) ||
    !/<div\b(?=[^>]*\bid=["']root["'])[^>]*>\s*<\/div>/i.test(template)
  ) {
    throw new Error("Vite output is missing the empty application shell required by the ad renderer.");
  }

  const withoutRobots = template.replace(
    /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/gi,
    ""
  );
  return withoutRobots.replace(
    /<\/head>/i,
    '    <meta name="robots" content="noindex,nofollow"/>\n  </head>'
  );
}
