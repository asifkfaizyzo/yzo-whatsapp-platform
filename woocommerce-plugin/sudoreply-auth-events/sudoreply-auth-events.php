<?php
/**
 * Plugin Name: SudoReply WooCommerce Auth Events
 * Description: Sends signed WooCommerce customer login and password-reset events to SudoReply.
 * Version: 1.0.0
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
                        <td><input class="regular-text" type="url" id="sudoreply_endpoint" name="endpoint" value="<?php echo esc_attr($settings['endpoint']); ?>" required></td>
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

        $body = wp_json_encode($event);
        if (!is_string($body)) {
            return false;
        }
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $body, $settings['signing_secret']);
        $response = wp_remote_post($settings['endpoint'], [
            'timeout' => 8,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-SudoReply-Timestamp' => $timestamp,
                'X-SudoReply-Signature' => 'sha256=' . $signature,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            error_log('[SudoReply Auth Events] Webhook request failed: ' . $response->get_error_message());
            return false;
        }
        $status = (int) wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            error_log('[SudoReply Auth Events] Backend rejected event with HTTP ' . $status);
            return false;
        }

        $result = json_decode(wp_remote_retrieve_body($response), true);
        return isset($result['delivery']) ? $result['delivery'] : false;
    }
}

new SudoReply_WooCommerce_Auth_Events();
