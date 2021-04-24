import { PluginSdk } from "../../../utils/plugin-provider/plugin-app-sdk";
import { PluginSdkService } from "../../../utils/plugin-provider/plugin-service";

const EVKEY = "data-mapper-custom-transport";
export interface _Event_DataMapper_GoodUserInputTransfer {
  sourceNodeId: string;
  targetNodeId: string;
}

export function fromApp(data: _Event_DataMapper_GoodUserInputTransfer) {
  PluginSdk.appEvent(EVKEY, data);
}

export function onService(
  cb: (data: _Event_DataMapper_GoodUserInputTransfer) => void
) {
  PluginSdkService.onAppReqquest(EVKEY, cb);
}
