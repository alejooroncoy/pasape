#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registro del plugin local TcpCoord en el runtime de Capacitor iOS (descubierto
// vía esta macro; no se toca AppDelegate). Métodos = src/lib/scanning/coordination/tcpPlugin.ts.
CAP_PLUGIN(TcpCoordPlugin, "TcpCoord",
    CAP_PLUGIN_METHOD(connect, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(send, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(close, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startServer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(broadcast, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopServer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getNetworkInfo, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(addListener, CAPPluginReturnCallback);
    CAP_PLUGIN_METHOD(removeAllListeners, CAPPluginReturnPromise);
)
