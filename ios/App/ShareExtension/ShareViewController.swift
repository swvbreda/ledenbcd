import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private let openButton = UIButton(type: .system)
    private var sharedParts: [String] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureInterface()
        loadSharedContent()
    }

    private func configureInterface() {
        let titleLabel = UILabel()
        titleLabel.text = "Delen met BCD leden"
        titleLabel.font = .preferredFont(forTextStyle: .title2)
        titleLabel.adjustsFontForContentSizeCategory = true

        statusLabel.text = "Bericht voorbereiden…"
        statusLabel.numberOfLines = 0
        statusLabel.textColor = .secondaryLabel

        openButton.setTitle("Open in BCD leden", for: .normal)
        openButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        openButton.isEnabled = false
        openButton.addTarget(self, action: #selector(openContainingApp), for: .touchUpInside)

        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Annuleren", for: .normal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [titleLabel, statusLabel, openButton, cancelButton])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
        ])
    }

    private func loadSharedContent() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        let group = DispatchGroup()
        let lock = NSLock()

        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] item, _ in
                    defer { group.leave() }
                    guard let value = item as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                    lock.lock(); self?.sharedParts.append(value); lock.unlock()
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] item, _ in
                    defer { group.leave() }
                    guard let value = item as? URL else { return }
                    lock.lock(); self?.sharedParts.append(value.absoluteString); lock.unlock()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            if self.sharedParts.isEmpty {
                self.statusLabel.text = "Er is geen tekst of link gevonden in dit WhatsApp-bericht."
            } else {
                self.statusLabel.text = "Open de leden-app om de aankondiging te controleren en te publiceren."
                self.openButton.isEnabled = true
            }
        }
    }

    @objc private func openContainingApp() {
        let text = sharedParts.joined(separator: "\n\n")
        var components = URLComponents()
        components.scheme = "bcdleden"
        components.host = "share"
        components.queryItems = [URLQueryItem(name: "text", value: text)]
        guard let url = components.url else { return }

        extensionContext?.open(url) { [weak self] success in
            if success {
                self?.extensionContext?.completeRequest(returningItems: nil)
            } else {
                DispatchQueue.main.async {
                    self?.statusLabel.text = "Open BCD leden handmatig en probeer opnieuw."
                }
            }
        }
    }

    @objc private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
    }
}
