import React from "react";
import { nodes } from "@design-sdk/core";
import { VariantPropertyParser } from "@design-sdk/figma/features/variant";
import { CodeBox } from "@ui/codebox";
import {
  buildeExampleData,
  buildInterfaceString,
  jsxViewExampleBuilder,
} from "../interface-code-builder";
import { nameit, NameCases } from "@coli.codes/naming";
import { Interface } from "@code-ui/interface";
import {
  InterfaceAttr,
  InterfaceProps,
  InterfaceTypeOption,
} from "@code-ui/interface/dist/lib/type";

export default function (props: { node: nodes.light.IReflectNodeReference }) {
  const master = props.node;

  const parser = new VariantPropertyParser(master);
  const data_of_properties = parser.getData(master);
  const interfaceName = nameit(master.parent.name + "-props", {
    case: NameCases.pascal,
  }).name;

  const interfaceAttrs: InterfaceAttr[] = parser.properties.map((d) => {
    const _contorls: InterfaceTypeOption = {
      name: "name",
      value: "string",
      description: "type",
    };
    return {
      label: d.key,
      contorls: [_contorls],
    };
  });
  const viewName = nameit(master.parent.name, {
    case: NameCases.pascal,
  }).name;

  return (
    <>
      <h6>variant</h6>

      <Interface
        lang={"js"}
        theme={"monokai"}
        interfaceName={interfaceName}
        attrs={interfaceAttrs}
        onChange={() => {}}
      />
      <CodeBox
        language="jsx"
        code={buildInterfaceString({
          name: interfaceName,
          properties: parser.properties.map((d) => {
            return {
              name: d.key,
              type: d.type,
            };
          }),
        })}
      />
      <CodeBox
        language="jsx"
        code={buildeExampleData({
          name: "data",
          interfaceName: interfaceName,
          properties: data_of_properties,
        })}
      />

      <CodeBox
        language="jsx"
        code={jsxViewExampleBuilder({
          varName: "view",
          viewTag: viewName,
          typeReference: viewName,
          properties: data_of_properties,
        })}
      />
    </>
  );
}
