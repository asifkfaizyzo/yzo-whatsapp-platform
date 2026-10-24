<?php
/**
 * Plugin Name: SudoReply WooCommerce Events
 * Description: Sends signed WooCommerce customer and abandoned-cart events to SudoReply.
 * Version: 1.1.0
 * Requires PHP: 7.4
 * Requires at least: 5.7
 * Requires Plugins: woocommerce
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

final class SudoReply_WooCommerce_Auth_Events {
    private const OPTION = 'sudoreply_woo_auth_events';
    private $suppress_reset_email = [];

    public function __construct() {
        add_action('wp_login', [$this, 'on_customer_login'], 10, 2);
        add_filter('retrieve_password_message', [$this, 'on_password_reset_requested'], 10, 4);
        add_filter('pre_wp_mail', [$this, 'maybe_suppress_reset_email'], 10, 2);
        add_action('woocommerce_checkout_update_order_review', [$this, 'capture_classic_checkout_cart']);
        add_action('woocommerce_store_api_checkout_update_order_from_request', [$this, 'capture_store_api_checkout_cart'], 10, 2);
        add_action('woocommerce_checkout_create_order', [$this, 'attach_cart_recovery_id_to_order'], 10, 2);
        add_action('woocommerce_store_api_checkout_update_order_meta', [$this, 'attach_cart_recovery_id_to_store_api_order'], 10, 1);
        add_action('woocommerce_checkout_order_processed', [$this, 'on_classic_order_processed'], 20, 3);
        add_action('woocommerce_store_api_checkout_order_processed', [$this, 'on_store_api_order_processed'], 20, 1);
        add_action('template_redirect', [$this, 'restore_cart_from_recovery_link']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_classic_checkout_cart_capture']);
        add_action('admin_menu', [$this, 'add_settings_page']);
        add_action('admin_post_sudoreply_save_auth_event_settings', [$this, 'save_settings']);
    }

    public function on_customer_login($user_login, $user) {
        if (!$this->is_customer($user)) {
            return;
        }

        $this->send_event('customer.login', $user);
    }

    public function on_password_reset_requested($message, $key, $user_login, $user_data) {
        if (!$this->is_customer($user_data)) {
            return $message;
        }

        $decoded_message = html_entity_decode($message, ENT_QUOTES, get_bloginfo('charset') ?: 'UTF-8');
        if (!preg_match('~https?://[^\s<>"\']+~i', $decoded_message, $matches)) {
            return $message;
        }

        $reset_url = rtrim($matches[0], ".,);]");
        if ($this->send_event('customer.password_reset_requested', $user_data, $reset_url) === 'sent') {
            $this->suppress_reset_email[strtolower($user_data->user_email)] = true;
        }

        return $message;
    }

    public function maybe_suppress_reset_email($pre, $atts) {
        if ($pre !== null || empty($atts['to'])) {
            return $pre;
        }

        $recipients = is_array($atts['to']) ? $atts['to'] : explode(',', $atts['to']);
        foreach ($recipients as $recipient) {
            $address = is_string($recipient) ? $recipient : ($recipient->address ?? '');
            $address = strtolower(trim($address));
            if ($address !== '' && !empty($this->suppress_reset_email[$address])) {
                unset($this->suppress_reset_email[$address]);
                return true;
            }
        }

        return $pre;
    }

    public function add_settings_page() {
        add_options_page(
            'SudoReply Auth Events',
            'SudoReply Auth Events',
            'manage_woocommerce',
            'sudoreply-auth-events',
            [$this, 'render_settings_page']
        );
    }

    public function render_settings_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $settings = $this->settings();
        ?>
        <div class="wrap">
            <h1>SudoReply WooCommerce Auth Events</h1>
            <p>Configure the signed endpoint from your SudoReply account’s WooCommerce integration settings.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('sudoreply_save_auth_event_settings'); ?>
                <input type="hidden" name="action" value="sudoreply_save_auth_event_settings">
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="sudoreply_endpoint">SudoReply endpoint</label></th>
                        <td><input class="regular-text" type="url" id="sudoreply_endpoint" name="endpoint" value="<?php echo esc_attr($settings['endpoint']); ?>"><p class="description">Optional endpoint for customer login and password-reset events.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sudoreply_cart_endpoint">SudoReply cart recovery endpoint</label></th>
                        <td><input class="regular-text" type="url" id="sudoreply_cart_endpoint" name="cart_endpoint" value="<?php echo esc_attr($settings['cart_endpoint']); ?>"><p class="description">Configure this endpoint to enable abandoned-checkout reminders. Keep the tenant ID and signing secret shared with your SudoReply integration.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sudoreply_tenant_id">SudoReply tenant ID</label></th>
                        <td><input class="regular-text" type="text" id="sudoreply_tenant_id" name="tenant_id" value="<?php echo esc_attr($settings['tenant_id']); ?>" required></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sudoreply_signing_secret">Signing secret</label></th>
                        <td><input class="regular-text" type="password" id="sudoreply_signing_secret" name="signing_secret" value="" autocomplete="new-password"><p class="description">Leave blank to keep the current secret.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sudoreply_phone_meta_key">Customer phone meta key</label></th>
                        <td><input class="regular-text" type="text" id="sudoreply_phone_meta_key" name="phone_meta_key" value="<?php echo esc_attr($settings['phone_meta_key']); ?>"><p class="description">Use billing_phone for the standard WooCommerce billing number, or configure your store’s custom key.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sudoreply_verified_meta_key">Verified-phone meta key</label></th>
                        <td><input class="regular-text" type="text" id="sudoreply_verified_meta_key" name="verified_meta_key" value="<?php echo esc_attr($settings['verified_meta_key']); ?>"><p class="description">Must be a store field that confirms phone ownership. Leave blank until your store verifies phone numbers; live sends require verification.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sudoreply_verified_value">Verified-phone value</label></th>
                        <td><input class="regular-text" type="text" id="sudoreply_verified_value" name="verified_value" value="<?php echo esc_attr($settings['verified_value']); ?>"></td>
                    </tr>
                </table>
                <?php submit_button('Save settings'); ?>
            </form>
        </div>
        <?php
    }

    public function save_settings() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die(esc_html__('You are not allowed to change these settings.', 'sudoreply-auth-events'));
        }
        check_admin_referer('sudoreply_save_auth_event_settings');

        $current = $this->settings();
        $secret = isset($_POST['signing_secret'])
            ? sanitize_text_field(wp_unslash($_POST['signing_secret']))
            : '';
        $settings = [
            'endpoint' => isset($_POST['endpoint']) ? esc_url_raw(wp_unslash($_POST['endpoint'])) : '',
            'cart_endpoint' => isset($_POST['cart_endpoint']) ? esc_url_raw(wp_unslash($_POST['cart_endpoint'])) : '',
            'tenant_id' => isset($_POST['tenant_id']) ? sanitize_text_field(wp_unslash($_POST['tenant_id'])) : '',
            'signing_secret' => $secret !== '' ? $secret : $current['signing_secret'],
            'phone_meta_key' => isset($_POST['phone_meta_key']) ? sanitize_key(wp_unslash($_POST['phone_meta_key'])) : 'billing_phone',
            'verified_meta_key' => isset($_POST['verified_meta_key']) ? sanitize_key(wp_unslash($_POST['verified_meta_key'])) : '',
            'verified_value' => isset($_POST['verified_value']) ? sanitize_text_field(wp_unslash($_POST['verified_value'])) : 'yes',
        ];
        update_option(self::OPTION, $settings, false);

        wp_safe_redirect(admin_url('options-general.php?page=sudoreply-auth-events&updated=1'));
        exit;
    }

    private function settings() {
        $settings = get_option(self::OPTION, []);
        return wp_parse_args(is_array($settings) ? $settings : [], [
            'endpoint' => '',
            'cart_endpoint' => '',
            'tenant_id' => '',
            'signing_secret' => '',
            'phone_meta_key' => 'billing_phone',
            'verified_meta_key' => '',
            'verified_value' => 'yes',
        ]);
    }

    private function is_customer($user) {
        return $user instanceof WP_User
            && array_intersect(['customer', 'subscriber'], (array) $user->roles);
    }

    private function customer_data($user) {
        $settings = $this->settings();
        $phone = $settings['phone_meta_key'] === 'billing_phone' && function_exists('wc_get_customer')
            ? (wc_get_customer($user->ID) ? wc_get_customer($user->ID)->get_billing_phone() : '')
            : get_user_meta($user->ID, $settings['phone_meta_key'], true);
        $verified = $settings['verified_meta_key'] !== ''
            && (string) get_user_meta($user->ID, $settings['verified_meta_key'], true) === (string) $settings['verified_value'];

        return [
            'id' => (string) $user->ID,
            'name' => sanitize_text_field($user->display_name ?: $user->user_login),
            'phone' => sanitize_text_field((string) $phone),
            'phoneVerified' => $verified,
        ];
    }

    private function send_event($topic, $user, $reset_url = null) {
        $settings = $this->settings();
        if ($settings['endpoint'] === '' || $settings['tenant_id'] === '' || $settings['signing_secret'] === '') {
            return false;
        }

        $event = [
            'topic' => $topic,
            'storeUrl' => home_url('/'),
            'occurredAt' => gmdate('c'),
            'customer' => $this->customer_data($user),
        ];
        if ($reset_url !== null) {
            $event['resetUrl'] = esc_url_raw($reset_url);
        }

        return $this->send_signed_event($settings['endpoint'], $settings['signing_secret'], $event);
    }

    public function capture_classic_checkout_cart($posted_data) {
        $fields = [];
        if (is_string($posted_data)) {
            parse_str($posted_data, $fields);
        }
        $this->capture_cart_event([
            'name' => trim(
                sanitize_text_field($fields['billing_first_name'] ?? '') . ' '
                . sanitize_text_field($fields['billing_last_name'] ?? '')
            ),
            'phone' => sanitize_text_field($fields['billing_phone'] ?? ''),
            'email' => sanitize_email($fields['billing_email'] ?? ''),
        ]);
    }

    public function enqueue_classic_checkout_cart_capture() {
        $settings = $this->settings();
        if ($settings['cart_endpoint'] === '' || !function_exists('is_checkout')
            || !is_checkout() || is_order_received_page()) {
            return;
        }
        wp_add_inline_script(
            'wc-checkout',
            "jQuery(function($){$(document.body).on('blur change','#billing_phone',function(){ $(document.body).trigger('update_checkout'); });});",
            'after'
        );
    }

    public function capture_store_api_checkout_cart($order, $request) {
        if (!$order instanceof WC_Order) {
            return;
        }
        $this->capture_cart_event([
            'name' => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
            'phone' => $order->get_billing_phone(),
            'email' => $order->get_billing_email(),
        ]);
    }

    public function attach_cart_recovery_id_to_order($order, $data) {
        $cart_id = $this->current_cart_recovery_id();
        if ($cart_id && $order instanceof WC_Order) {
            $order->update_meta_data('_sudoreply_cart_recovery_id', $cart_id);
        }
    }

    public function attach_cart_recovery_id_to_store_api_order($order) {
        if (is_numeric($order)) {
            $order = wc_get_order($order);
        }
        $cart_id = $this->current_cart_recovery_id();
        if ($cart_id && $order instanceof WC_Order) {
            $order->update_meta_data('_sudoreply_cart_recovery_id', $cart_id);
            $order->save_meta_data();
        }
    }

    public function on_classic_order_processed($order_id, $posted_data, $order) {
        $this->send_cart_conversion_event($order ?: $order_id);
    }

    public function on_store_api_order_processed($order) {
        $this->send_cart_conversion_event($order);
    }

    private function send_cart_conversion_event($order) {
        $settings = $this->settings();
        if ($settings['cart_endpoint'] === '' || $settings['tenant_id'] === ''
            || $settings['signing_secret'] === '') {
            return;
        }
        if (is_numeric($order)) {
            $order = wc_get_order($order);
        }
        if (!$order instanceof WC_Order) {
            return;
        }
        $cart_id = sanitize_text_field((string) $order->get_meta('_sudoreply_cart_recovery_id'));
        if ($cart_id === '') {
            $cart_id = $this->current_cart_recovery_id();
            $order->update_meta_data('_sudoreply_cart_recovery_id', $cart_id);
            $order->save_meta_data();
        }

        $this->send_signed_event($settings['cart_endpoint'], $settings['signing_secret'], [
            'topic' => 'cart.converted',
            'eventId' => bin2hex(random_bytes(16)),
            'storeUrl' => home_url('/'),
            'occurredAt' => gmdate('c'),
            'cartId' => $cart_id,
            'customer' => [
                'name' => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()) ?: 'Customer',
                'phone' => sanitize_text_field((string) $order->get_billing_phone()),
                'email' => sanitize_email($order->get_billing_email()),
            ],
        ]);

        if (function_exists('WC') && WC()->session) {
            WC()->session->set('sudoreply_cart_recovery_id', bin2hex(random_bytes(20)));
        }
    }

    public function restore_cart_from_recovery_link() {
        if (!isset($_GET['sudoreply_recover_cart']) || !function_exists('WC') || !WC()->cart) {
            return;
        }
        $token = sanitize_text_field(wp_unslash($_GET['sudoreply_recover_cart']));
        if (!preg_match('/^[a-f0-9]{48}$/', $token)) {
            return;
        }
        $snapshot = get_transient('sudoreply_recover_cart_' . $token);
        if (!is_array($snapshot) || empty($snapshot['items'])) {
            return;
        }

        WC()->cart->empty_cart();
        $restored = 0;
        foreach ($snapshot['items'] as $item) {
            $product_id = absint($item['product_id'] ?? 0);
            $quantity = max(1, absint($item['quantity'] ?? 1));
            $variation_id = absint($item['variation_id'] ?? 0);
            $variation = is_array($item['variation'] ?? null) ? $item['variation'] : [];
            if ($product_id && wc_get_product($variation_id ?: $product_id)) {
                if (WC()->cart->add_to_cart($product_id, $quantity, $variation_id, $variation)) {
                    $restored++;
                }
            }
        }
        if ($restored === 0) {
            return;
        }
        if (WC()->session && !empty($snapshot['cart_id'])) {
            WC()->session->set('sudoreply_cart_recovery_id', sanitize_text_field($snapshot['cart_id']));
        }
        delete_transient('sudoreply_recover_cart_' . $token);
        wp_safe_redirect(wc_get_checkout_url());
        exit;
    }

    private function current_cart_recovery_id() {
        if (!function_exists('WC') || !WC()->session) {
            return '';
        }
        $cart_id = sanitize_text_field((string) WC()->session->get('sudoreply_cart_recovery_id'));
        if ($cart_id === '') {
            $cart_id = bin2hex(random_bytes(20));
            WC()->session->set('sudoreply_cart_recovery_id', $cart_id);
        }
        return $cart_id;
    }

    private function capture_cart_event($customer) {
        $settings = $this->settings();
        if ($settings['cart_endpoint'] === '' || $settings['tenant_id'] === ''
            || $settings['signing_secret'] === '' || !function_exists('WC')
            || !WC()->cart || WC()->cart->is_empty()) {
            return;
        }

        $phone = preg_replace('/[^0-9+]/', '', (string) ($customer['phone'] ?? ''));
        if (strlen(preg_replace('/\D/', '', $phone)) < 8) {
            return;
        }
        $items = [];
        $restore_items = [];
        foreach (WC()->cart->get_cart() as $cart_item) {
            $product = $cart_item['data'] ?? null;
            if (!$product instanceof WC_Product) {
                continue;
            }
            $product_id = absint($cart_item['product_id'] ?? $product->get_id());
            $variation_id = absint($cart_item['variation_id'] ?? 0);
            $image_id = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '';
            $items[] = [
                'name' => sanitize_text_field($product->get_name()),
                'quantity' => max(1, absint($cart_item['quantity'] ?? 1)),
                'price' => (string) wc_get_price_to_display($product),
                'productId' => $product_id,
                'variationId' => $variation_id ?: null,
                'imageUrl' => $image_url ? esc_url_raw($image_url) : null,
            ];
            $restore_items[] = [
                'product_id' => $product_id,
                'variation_id' => $variation_id,
                'variation' => is_array($cart_item['variation'] ?? null) ? $cart_item['variation'] : [],
                'quantity' => max(1, absint($cart_item['quantity'] ?? 1)),
            ];
        }
        if (!$items) {
            return;
        }

        $cart_id = $this->current_cart_recovery_id();
        $token = bin2hex(random_bytes(24));
        set_transient('sudoreply_recover_cart_' . $token, [
            'cart_id' => $cart_id,
            'items' => $restore_items,
        ], 7 * DAY_IN_SECONDS);
        $checkout_url = add_query_arg('sudoreply_recover_cart', $token, home_url('/'));

        $this->send_signed_event($settings['cart_endpoint'], $settings['signing_secret'], [
            'topic' => 'cart.updated',
            'eventId' => bin2hex(random_bytes(16)),
            'storeUrl' => home_url('/'),
            'occurredAt' => gmdate('c'),
            'cartId' => $cart_id,
            'customer' => [
                'name' => sanitize_text_field($customer['name'] ?? '') ?: 'Customer',
                'phone' => $phone,
                'email' => sanitize_email($customer['email'] ?? ''),
            ],
            'cart' => [
                'total' => (float) WC()->cart->get_total('edit'),
                'currency' => get_woocommerce_currency(),
                'checkoutUrl' => esc_url_raw($checkout_url),
                'lineItems' => $items,
            ],
        ]);
    }

    private function send_signed_event($endpoint, $secret, $event) {
        $body = wp_json_encode($event);
        if (!is_string($body)) {
            return false;
        }
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $body, $secret);
        $response = wp_remote_post($endpoint, [
            'timeout' => 8,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-SudoReply-Timestamp' => $timestamp,
                'X-SudoReply-Signature' => 'sha256=' . $signature,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            error_log('[SudoReply WooCommerce Events] Webhook request failed: ' . $response->get_error_message());
            return false;
        }
        $status = (int) wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            error_log('[SudoReply WooCommerce Events] Backend rejected event with HTTP ' . $status);
            return false;
        }

        $result = json_decode(wp_remote_retrieve_body($response), true);
        return isset($result['delivery']) ? $result['delivery'] : false;
    }
}

new SudoReply_WooCommerce_Auth_Events();
