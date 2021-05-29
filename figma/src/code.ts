import { convert } from "@design-sdk/figma";
import { flutter } from "@designto/code";
import { runLints } from "@designto/clean";

import {
  analyzeSelection,
  SelectionAnalysis,
} from "app/lib/utils/plugin-provider/pugin-app/utils";
import {
  hideAllExcept,
  hideAllOnly,
  randimizeText,
} from "./tool-box/manipulate";
import {
  EK_COMPUTE_STARTED,
  EK_CREATE_ICON,
  EK_FOCUS_REQUEST,
  EK_GENERATED_CODE_PLAIN,
  EK_IMAGE_ASSET_REPOSITORY_MAP,
  EK_LINT_FEEDBACK,
  EK_PREVIEW_SOURCE,
  EK_REPLACE_FONT,
  EK_SET_APP_MODE,
  EK_VANILLA_TRANSPORT,
  EK_ICON_DRAG_AND_DROPPED,
} from "app/lib/constants/ek.constant";
import { vanilla, repo_assets } from "@design-sdk/core";
import { IconPlacement, renderSvgIcon } from "./reflect-render/icons.render";
import { Logger } from "app/lib/utils";
import {
  ReflectFrameNode,
  ReflectSceneNode,
  light,
} from "@design-sdk/core/nodes";
import { replaceAllTextFontInFrame } from "./tool-box/manipulate/font-replacer";
import { drawButtons } from "./reflect-render";
import { IconConfig } from "@reflect-ui/core/lib/icon/icon.config";
import { ImageRepositories } from "@design-sdk/figma/asset-repository";

// init plugin
/* do not delete this line */ import "app/lib/utils/plugin-init"; // NO REMOVE
import { PluginSdkService } from "app/lib/utils/plugin-provider/plugin-service";
import { MainImageRepository } from "@design-sdk/core/assets-repository";

let appMode: string = "code";
export let singleFigmaNodeSelection: SceneNode;
export let targetNodeId: string;

async function showUI() {
  // communicates with ui.html
  // load plugin with confugured w/h
  // restore previous size

  const MIN_WIDTH = 320;
  const MIN_HEIGHT = 600;

  let size: { w: number; h: number } = { w: 375, h: 812 };
  try {
    const savedsize: {
      w: number;
      h: number;
    } = await figma.clientStorage.getAsync("size");
    savedsize && (size = savedsize);
  } catch (_) {}

  figma.ui.onmessage = (msg) => {
    switch (msg.type) {
      case "resize":
        const w = Math.max(MIN_WIDTH, msg.size.w);
        const h = Math.max(MIN_HEIGHT, msg.size.h);
        figma.ui.resize(w, h);
        figma.clientStorage.setAsync("size", { w: w, h: h }).catch((err) => {}); // save size
        break;
    }
  };

  figma.showUI(__html__, { width: size.w, height: size.h });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runon(rnode: ReflectSceneNode) {
  // region
  // notify ui that the computing process has been started.
  // use this for when displaying loading indicator etc.. for general purpose.
  figma.ui.postMessage({
    type: EK_COMPUTE_STARTED,
    data: {
      mode: appMode,
    },
  });
  // endregion

  // if converted node returned nothing
  if (!rnode) {
    figma.notify(
      'not a valid selection. this node is ignored with name : "//@ignore"'
    );
    return;
  }

  //#region  run linter
  if (appMode == "lint") {
    const feedbacks = runLints(rnode);
    console.warn(feedbacks);
    figma.ui.postMessage({
      type: EK_LINT_FEEDBACK,
      data: feedbacks,
    });
  }
  //#endregion

  // region make vanilla
  if (appMode == "g11n" || appMode == "exporter") {
    const globalizatoinScreen = vanilla.makeVanilla(rnode as ReflectFrameNode);
    const vanillaTransportableImageRepository = await globalizatoinScreen.repository.makeTransportable();
    figma.ui.postMessage({
      type: EK_IMAGE_ASSET_REPOSITORY_MAP,
      data: vanillaTransportableImageRepository,
    });
    figma.ui.postMessage({
      type: EK_VANILLA_TRANSPORT,
      data: globalizatoinScreen,
    });
  }
  // endregion

  if (appMode == "code") {
    const buildResult = flutter.buildApp(rnode);

    // host images
    const transportableImageAssetRepository = await repo_assets.MainImageRepository.instance.current.makeTransportable();
    figma.ui.postMessage({
      type: EK_IMAGE_ASSET_REPOSITORY_MAP,
      data: transportableImageAssetRepository,
    });

    const widget = buildResult.widget;
    const app = flutter.makeApp({
      widget: widget,
      scrollable: buildResult.scrollable,
    });

    figma.ui.postMessage({
      type: EK_GENERATED_CODE_PLAIN,
      data: {
        code: widget.build().finalize(),
        app: app.build().finalize(),
      },
    });
  }

  // send preview image
  singleFigmaNodeSelection
    .exportAsync({
      format: "PNG",
      contentsOnly: true,
      constraint: {
        type: "HEIGHT",
        value: 250,
      },
    })
    .then((d) => {
      figma.ui.postMessage({
        type: EK_PREVIEW_SOURCE,
        data: {
          source: d,
          name: singleFigmaNodeSelection.name,
        },
      });
    });
}

figma.on("selectionchange", () => {
  // clear the console for better debugging
  console.clear();
  console.warn("log cleared. optimized for new build");
  const rawSelections = figma.currentPage.selection;
  console.log("selection", rawSelections);
  const selectionType = analyzeSelection(rawSelections);
  switch (selectionType) {
    case SelectionAnalysis.empty:
      // ignore when nothing was selected
      console.log("deselection");
      figma.ui.postMessage({
        type: "empty",
      });
      return;
    case SelectionAnalysis.multi:
      // force to <5 selection
      // return false or raise error if more than 5 nodes are selected.
      if (rawSelections.length > 5) {
        figma.notify("only less than 5 selection is supported", {
          timeout: 1.5,
        });
        return false;
      }

      // todo - add memoization
      const rnodes = rawSelections.map((s) => {
        return convert.intoReflectNode(s as any, s.parent as any);
      });
      Logger.debug("reflect-converted-selections", rnodes);

      // region sync selection event (search "selectionchange" for references)
      figma.ui.postMessage({
        type: "selectionchange",
        data: rnodes.map((n) => light.makeReference(n)),
      });
    // endregion

    case SelectionAnalysis.single:
      const target = figma.currentPage.selection[0];
      // check [ignoreStackParent] description
      singleFigmaNodeSelection = target;
      targetNodeId = singleFigmaNodeSelection.id;

      // todo - add memoization
      const rnode = convert.intoReflectNode(
        singleFigmaNodeSelection as any,
        singleFigmaNodeSelection.parent as any
      );

      Logger.debug("reflect-converted-selection", rnode);

      // region sync selection event (search "selectionchange" for references)
      figma.ui.postMessage({
        type: "selectionchange",
        data: light.makeReference(rnode),
      });
      // endregion

      runon(rnode);
      return;
  }
});

PluginSdkService.registerDragAndDropHandler(
  EK_ICON_DRAG_AND_DROPPED,
  (data, pos): Promise<any> => {
    createIcon(
      data,
      {
        x: pos.x,
        y: pos.y,
      },
      false
    );
    return;
  }
);

// todo pass data instead of relying in types
figma.ui.onmessage = async (msg) => {
  // logging
  // console.log("[event] figma plugin data received", msg);

  const generalHandlingResult = PluginSdkService.handle(msg);
  // if event is handled by general event handler, no additional handling is required.
  if (generalHandlingResult) {
    return;
  }

  const type = msg.type;
  const data = msg.data;

  if (type == EK_SET_APP_MODE) {
    appMode = msg.data;
    console.log(`app mode set event recieved, now setting as ${appMode}`);
  } else if (type == EK_FOCUS_REQUEST) {
    const target = figma.getNodeById(msg.data.id) as SceneNode;
    figma.currentPage.selection = [target];
    figma.viewport.scrollAndZoomIntoView([target]);
  } else if (type == EK_CREATE_ICON) {
    createIcon(data);
  } else if (type == EK_REPLACE_FONT) {
    if (singleFigmaNodeSelection.type == "FRAME") {
      const font = "Roboto";
      await replaceAllTextFontInFrame(singleFigmaNodeSelection, font);
      figma.notify(`successfuly changed font to ${font}`);
    } else {
      figma.notify("cannot replace font of non-frame node");
    }
  } else if (type == "randomize-selection") {
    randimizeText();
  } else if (type == "hide-all-except") {
    hideAllExceptFromCurrentSelection(msg.data.except);
  } else if (type == "hide-all-only") {
    hideAllOnlyFromCurrentSelection(msg.data.only);
  } else if (type == "reflect-ui-generation/button-base") {
    draw100000Buttons();
  }
};

function createIcon(
  data: { key: string; svg: string; config: IconConfig },
  placement: IconPlacement = "center",
  zoom: boolean = true
) {
  console.log("creating icon with data", data);
  const icon_key = data.key;
  const svgData = data.svg;
  const inserted = renderSvgIcon(
    icon_key,
    svgData,
    "#000000",
    placement,
    data.config
  );
  if (zoom) {
    figma.viewport.scrollAndZoomIntoView([inserted]);
  }
}

async function draw100000Buttons() {
  for (let i = 0; i < 1; i++) {
    await drawButtons(i);
  }
}

function hideAllExceptFromCurrentSelection(except: NodeType) {
  if (singleFigmaNodeSelection.type != "FRAME") {
    figma.notify("hide-all tools can be used only for framenode");
  } else {
    hideAllExcept(singleFigmaNodeSelection, except);
  }
}

function hideAllOnlyFromCurrentSelection(only: NodeType) {
  if (singleFigmaNodeSelection.type != "FRAME") {
    figma.notify("hide-all tools can be used only for framenode");
  } else {
    hideAllOnly(singleFigmaNodeSelection, only);
  }
}

function main() {
  MainImageRepository.instance = new ImageRepositories();

  showUI();
}

main();
