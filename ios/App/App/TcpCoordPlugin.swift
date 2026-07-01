import Foundation
import Capacitor
import Network

/**
 * Coordinación entre porteros (topología estrella) — lado CLIENTE en iOS.
 * El HOST (servidor TCP + relay) siempre es un Android; el iPhone solo se conecta.
 * La SPA lo consume vía src/lib/scanning/coordination/tcpPlugin.ts.
 *
 * Usa Network framework con requiredInterfaceType = .wifi → fuerza que la
 * coordinación viaje por la LAN del hotspot aunque el iPhone tenga datos móviles.
 * Requiere NSLocalNetworkUsageDescription en Info.plist (ya presente); iOS muestra
 * el prompt de "red local" la primera vez. NO usa broadcast/multicast → NO requiere
 * el entitlement de pago de Apple.
 *
 * Framing: newline-delimited JSON.
 */
@objc(TcpCoordPlugin)
public class TcpCoordPlugin: CAPPlugin {

    private var connection: NWConnection?
    private let queue = DispatchQueue(label: "lat.pasape.tcpcoord")
    private var buffer = Data()

    @objc func connect(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty,
              let portInt = call.getInt("port"),
              let port = NWEndpoint.Port(rawValue: UInt16(portInt)) else {
            call.reject("host/port inválido")
            return
        }
        let params = NWParameters.tcp
        params.requiredInterfaceType = .wifi   // forzar la LAN del hotspot
        let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: params)
        var resolved = false
        conn.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                if !resolved { resolved = true; call.resolve() }
                self?.receive(on: conn)
            case .failed(let err):
                if !resolved { resolved = true; call.reject("connect failed: \(err.localizedDescription)") }
            case .cancelled:
                self?.notifyListeners("disconnected", data: [:])
            default:
                break
            }
        }
        self.connection = conn
        conn.start(queue: queue)
    }

    private func receive(on conn: NWConnection) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty {
                self.buffer.append(data)
                self.flushLines()
            }
            if error == nil && !isComplete {
                self.receive(on: conn)
            } else {
                self.notifyListeners("disconnected", data: [:])
            }
        }
    }

    private func flushLines() {
        while let nl = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.subdata(in: buffer.startIndex..<nl)
            if let line = String(data: lineData, encoding: .utf8), !line.isEmpty {
                notifyListeners("message", data: ["data": line])
            }
            buffer = Data(buffer.suffix(from: buffer.index(after: nl)))
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let str = call.getString("data"), let data = str.data(using: .utf8),
              let conn = connection else {
            call.resolve()
            return
        }
        conn.send(content: data, completion: .contentProcessed { _ in })
        call.resolve()
    }

    @objc func close(_ call: CAPPluginCall) {
        connection?.cancel()
        connection = nil
        call.resolve()
    }

    // iOS es solo CLIENTE (el host/servidor es Android). Estos cumplen el contrato.
    @objc func startServer(_ call: CAPPluginCall) { call.reject("server no soportado en iOS") }
    @objc func broadcast(_ call: CAPPluginCall) { call.resolve() }
    @objc func stopServer(_ call: CAPPluginCall) { call.resolve() }

    @objc func getNetworkInfo(_ call: CAPPluginCall) {
        // iOS no lee el gateway aquí; el wiring usa el default del host Android.
        call.resolve([:])
    }

    deinit { connection?.cancel() }
}
