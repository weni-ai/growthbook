import { createHash } from "crypto";
import { SDKLanguage } from "back-end/types/sdk-connection";
import stringify from "json-stringify-pretty-compact";
import { SDKAttributeSchema } from "back-end/types/organization";
import { paddedVersionString } from "@growthbook/growthbook";
import { useAttributeSchema } from "@/services/features";
import Code from "@/components/SyntaxHighlighting/Code";

function phpArrayFormat(json: unknown) {
  return stringify(json)
    .replace(/\{/g, "[")
    .replace(/\}/g, "]")
    .replace(/:/g, " =>");
}

function swiftArrayFormat(json: unknown) {
  return stringify(json).replace(/\{/, "[").replace(/\}/g, "]");
}

function indentLines(code: string, indent: number | string = 2) {
  const spaces = typeof indent === "string" ? indent : " ".repeat(indent);
  return code.split("\n").join("\n" + spaces);
}

function replaceAttributeValues(
  attributesStr: string,
  values: Record<string, string>
) {
  Object.entries(values).forEach(([key, value]) => {
    attributesStr = attributesStr.replace(
      new RegExp(`"${key}": [^\n,]+`, "g"),
      `"${key}": ${value}`
    );
  });
  return attributesStr;
}

function getExampleAttributes({
  attributeSchema,
  hashSecureAttributes = false,
  secureAttributeSalt = "",
}: {
  attributeSchema?: SDKAttributeSchema;
  hashSecureAttributes?: boolean;
  secureAttributeSalt?: string;
}) {
  if (!attributeSchema?.length) return {};

  // eslint-disable-next-line
  const exampleAttributes: any = {};
  attributeSchema.forEach(({ property, datatype, enum: enumList }) => {
    const parts = property.split(".");
    const last = parts.pop() || "";
    let current = exampleAttributes;
    for (let i = 0; i < parts.length; i++) {
      current[parts[i]] = current[parts[i]] || {};
      current = current[parts[i]];
    }

    let value: unknown = null;
    if (datatype === "boolean") {
      value = true;
    } else if (datatype === "number") {
      value = 123;
    } else if (datatype === "string") {
      value = "foo";
    } else if (datatype === "secureString") {
      value = hashSecureAttributes ? sha256("foo", secureAttributeSalt) : "foo";
    } else if (datatype === "number[]") {
      value = [1, 2, 3];
    } else if (datatype === "string[]") {
      value = ["foo", "bar"];
    } else if (datatype === "secureString[]") {
      value = hashSecureAttributes
        ? ["foo", "bar"].map((v) => sha256(v, secureAttributeSalt))
        : ["foo", "bar"];
    } else if (datatype === "enum") {
      value = enumList?.split(",").map((v) => v.trim())[0] ?? null;
    }

    current[last] = value;
  });

  return exampleAttributes;
}

export default function TargetingAttributeCodeSnippet({
  language,
  hashSecureAttributes = false,
  secureAttributeSalt = "",
  version,
}: {
  language: SDKLanguage;
  hashSecureAttributes?: boolean;
  secureAttributeSalt?: string;
  version?: string;
}) {
  const introText = (
    <span>
      Replace the placeholders with your real targeting attribute values. This
      enables you to target feature flags based on user attributes.
    </span>
  );

  const attributeSchema = useAttributeSchema();
  const exampleAttributes = getExampleAttributes({
    attributeSchema,
    hashSecureAttributes,
    secureAttributeSalt,
  });

  if (language.match(/^nocode/)) {
    const defaultAttributes = [
      "id",
      "url",
      "path",
      "host",
      "query",
      "deviceType",
      "browser",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "utmTerm",
      "utmContent",
    ];
    const additionalAttributes = Object.entries(exampleAttributes).filter(
      ([k]) => !defaultAttributes.includes(k)
    );

    if (additionalAttributes.length) {
      return (
        <>
          <p>
            Some attributes are set automatically, but you will need to manually
            set the following ones. This must be added BEFORE the GrowthBook
            snippet.
          </p>
          {introText}
          <Code
            language="html"
            code={`
<script>
window.growthbook_config = window.growthbook_config || {};
window.growthbook_config.attributes = ${stringify(
              Object.fromEntries(additionalAttributes)
            )};
</script>
          `}
          />
        </>
      );
    }

    return (
      <>
        <div>
          All of your attributes are set automatically, no configuration
          required.
        </div>
      </>
    );
  }
  if (language === "javascript") {
    return (
      <>
        {introText}
        <Code
          language="javascript"
          code={`growthbook.setAttributes(${stringify(exampleAttributes)});`}
        />
      </>
    );
  }
  if (language === "react") {
    return (
      <>
        {introText}
        <Code
          language="tsx"
          code={`growthbook.setAttributes(${stringify(exampleAttributes)});`}
        />
      </>
    );
  }
  if (language === "nodejs") {
    const useMultiUser =
      paddedVersionString(version) >= paddedVersionString("1.3.1");

    const attributes = replaceAttributeValues(stringify(exampleAttributes), {
      id: "req.user.id",
      email: "req.user.email",
      url: "req.originalUrl",
      path: "req.path",
      host: "req.hostname",
      query: "req.query",
    });

    if (useMultiUser) {
      return (
        <>
          {introText}
          <Code
            language="javascript"
            code={`
app.use((req, res, next) => {
  const userContext = {
    attributes: ${indentLines(attributes, 4)}
  }
  
  req.growthbook = client.getScopedInstance(userContext);
});
          `.trim()}
          />
        </>
      );
    }

    return (
      <>
        {introText}
        <Code
          language="javascript"
          code={`
app.use(function(req, res, next) {
  req.growthbook.setAttributes(${indentLines(stringify(exampleAttributes), 2)});
  next();
})
`.trim()}
        />
      </>
    );
  }
  if (language === "android") {
    return (
      <>
        {introText}
        <Code
          language="kotlin"
          code={`
val attrs = HashMap<String, Any>()
${Object.keys(exampleAttributes)
  .map((k) => {
    return `attrs.put("${k}", ${JSON.stringify(exampleAttributes[k])})`;
  })
  .join("\n")}

gb.setAttributes(attrs)
`.trim()}
        />
      </>
    );
  }
  if (language === "ios") {
    return (
      <>
        {introText}
        <Code
          language="swift"
          code={`
var attrs = ${swiftArrayFormat(exampleAttributes)}
gb.setAttributes(attrs)
    `.trim()}
        />
      </>
    );
  }
  if (language === "go") {
    return (
      <>
        {introText}
        <Code
          language="go"
          code={`
data := []byte(\`${JSON.stringify(exampleAttributes, null, " ")}\`)
var jsonMap map[string]any
if err := json.Unmarshal(data, &jsonMap); err != nil {
  log.Fatal("Invalid JSON")
}
client,err := client.WithAttributes(gb.Attributes(jsonMap))
        `.trim()}
        />
      </>
    );
  }
  if (language === "ruby") {
    return (
      <>
        {introText}
        <Code
          language="ruby"
          code={`gb.attributes=${stringify(exampleAttributes).replace(
            /: null/g,
            ": nil"
          )}`}
        />
      </>
    );
  }
  if (language === "php") {
    return (
      <>
        {introText}
        <Code
          language="php"
          code={`$growthbook->withAttributes(${phpArrayFormat(
            exampleAttributes
          )});`}
        />
      </>
    );
  }
  if (language === "python") {
    return (
      <>
        {introText}
        <Code
          language="python"
          code={`gb.set_attributes(${stringify(exampleAttributes)
            .replace(/: true/g, ": True")
            .replace(/: false/g, ": False")
            .replace(/: null/g, ": None")})`}
        />
      </>
    );
  }
  if (language === "java") {
    return (
      <>
        {introText}
        <Code
          language="java"
          code={`
JSONObject userAttributesObj = new JSONObject();
${Object.entries(exampleAttributes)
  .map(([key, value]) => {
    return `userAttributesObj.put(${JSON.stringify(key)}, ${JSON.stringify(
      value
    )});`;
  })
  .join("\n")}
String userAttributesJson = userAttributesObj.toString();
growthBook.setAttributes(userAttributesJson);
            `.trim()}
        />
      </>
    );
  }
  if (language === "flutter") {
    return (
      <>
        {introText}
        <Code
          language="dart"
          code={`
val attrs = HashMap<String, Any>()
${Object.entries(exampleAttributes)
  .map(([key, value]) => {
    return `attrs.put(${JSON.stringify(key)}, ${JSON.stringify(value)})`;
  })
  .join("\n")}
gb.setAttributes(attrs);
`.trim()}
        />
      </>
    );
  }
  if (language === "csharp") {
    return (
      <>
        {introText}
        <Code
          language="csharp"
          code={`
var attrs = new JObject();
${Object.entries(exampleAttributes)
  .map(([key, value]) => {
    return `attrs.Add(${JSON.stringify(key)}, ${JSON.stringify(value)});`;
  })
  .join("\n")}
gb.SetAttributes(attrs);
    `.trim()}
        />
      </>
    );
  }
  if (language === "elixir") {
    return (
      <>
        {introText}
        <Code
          language="elixir"
          code={`
attrs = %{
${Object.entries(exampleAttributes)
  .map(([key, value]) => {
    return `  ${JSON.stringify(key)} => ${JSON.stringify(value)}`;
  })
  .join(",\n")}
}

context = %GrowthBook.Context{
  features: features,
  attributes: attrs
}
          `.trim()}
        />
      </>
    );
  }

  return null;
}

function sha256(str: string, salt: string): string {
  return createHash("sha256")
    .update(salt + str)
    .digest("hex");
}
